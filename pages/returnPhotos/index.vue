<template>
	<view class="page">
		<!-- 顶部栏 -->
		<view class="header">
			<text class="back-btn" @tap="goBack">‹</text>
			<text class="header-title">{{ tips.ReturnVehicle[lang] }}</text>
			<view class="header-placeholder"></view>
		</view>

		<scroll-view scroll-y class="photo-list">
			<button
				v-for="item in photoItems"
				:key="item.key"
				class="photo-btn"
				hover-class="ctrl-tap"
				@tap="choosePhoto(item)">
				<image v-if="item.path" class="photo-preview" mode="aspectFill" :src="item.path" @tap.stop="previewPhoto(item)" />
				<view v-else class="photo-placeholder">
					<text class="plus">+</text>
					<text class="photo-label">{{ tips[item.tipKey][lang] }}</text>
				</view>
				<text v-if="item.path" class="photo-label photo-label-on-img">{{ tips[item.tipKey][lang] }}</text>
			</button>
		</scroll-view>

		<!-- 备注输入区（选填） -->
		<view class="remark-section">
			<text class="remark-label">{{ tips.Remark[lang] }}</text>
			<textarea
				class="remark-input"
				v-model="bak"
				:placeholder="tips.RemarkPlaceholder[lang]"
				placeholder-class="remark-placeholder"
				:maxlength="200"
			/>
		</view>

		<button class="submit-btn" hover-class="ctrl-tap" :disabled="submitting" @tap="submitBtnTap">
			{{ submitting ? tips.Uploading[lang] : tips.SubmitFinish[lang] }}
		</button>
	</view>
</template>

<script>
	import { tips } from '@/utils/langtips.js'
	import { LANG_OPTIONS, langIndexOf } from '@/utils/langOptions.js'

	const SAVE_IMG_URL = 'https://k1sw.wiselink.net.cn/renterApi/saveImg'
	const RETURN_CAR_URL = 'https://k1sw.wiselink.net.cn/renterApi/returnCar'

	export default {
		data() {
			return {
				tips,
				lang: 'enUs',
				code: '',
				submitting: false,
				// 5 张照片：字段名与后端约定 img1Arr ~ img5Arr 保持一致
				photoItems: [
					{ key: 0, field: 'img1Arr', tipKey: 'FrontPhoto', path: '' },
					{ key: 1, field: 'img2Arr', tipKey: 'RearPhoto', path: '' },
					{ key: 2, field: 'img3Arr', tipKey: 'LeftPhoto', path: '' },
					{ key: 3, field: 'img4Arr', tipKey: 'RightPhoto', path: '' },
					{ key: 4, field: 'img5Arr', tipKey: 'KeyPhoto', path: '' }
				],
				// 还车备注（选填，字段名 bak 与后端约定一致），随 returnCar 一并提交
				bak: ''
			}
		},
		onLoad(options) {
			this.code = (options && options.code) || ''
			this.initLang()
		},
		methods: {
			initLang() {
				const cached = uni.getStorageSync('language')
				// 默认英文（清单第一项）；缓存非法时回退默认
				this.lang = LANG_OPTIONS[langIndexOf(cached)].value
			},
			goBack() {
				const pages = getCurrentPages()
				if (pages.length > 1) {
					uni.navigateBack({ delta: 1 })
				} else {
					uni.reLaunch({ url: '/pages/index/index' })
				}
			},
			choosePhoto(item) {
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['album', 'camera'],
					success: (res) => {
						if (res.tempFilePaths && res.tempFilePaths[0]) {
							item.path = res.tempFilePaths[0]
						}
					},
					fail: (err) => {
						console.warn('选择照片失败', err)
					}
				})
			},
			previewPhoto(item) {
				const urls = this.photoItems.map(p => p.path).filter(Boolean)
				if (!urls.length) return
				uni.previewImage({ urls, current: item.path })
			},
			// 直写请求头：仅携带时间戳
			buildHeader() {
				return { timestamp: Date.parse(new Date()) }
			},
			uploadOnePhoto(item) {
				return new Promise((resolve, reject) => {
					uni.uploadFile({
						url: SAVE_IMG_URL,
						filePath: item.path,
						name: item.field,
						formData: { code: this.code },
						header: this.buildHeader(),
						success: (res) => {
							try {
								const data = JSON.parse(res.data)
								if (res.statusCode === 200 && data.code === 1000) {
									resolve(data)
								} else {
									reject(new Error(data.msg || 'upload failed'))
								}
							} catch (e) {
								reject(e)
							}
						},
						fail: reject
					})
				})
			},
			submitBtnTap() {
				if (this.submitting) return
				const missing = this.photoItems.find(p => !p.path)
				if (missing) {
					uni.showToast({ title: this.tips.NeedAllPhotos[this.lang], icon: 'none' })
					return
				}
				if (!this.code) {
					uni.showToast({ title: this.tips.NoVehicle[this.lang], icon: 'none' })
					return
				}
				this.finishReturn()
			},
			async finishReturn() {
				this.submitting = true
				uni.showLoading({ title: this.tips.Uploading[this.lang], mask: true })
				try {
					// 先并行上传 5 张照片，全部成功后再提交还车
					await Promise.all(this.photoItems.map(item => this.uploadOnePhoto(item)))
					await this.requestReturnCar()
					uni.hideLoading()
					uni.showModal({
						title: this.tips.Tip[this.lang],
						content: this.tips.SubmitSuccess[this.lang],
						showCancel: false,
						confirmText: this.tips.Confirm[this.lang],
						success: () => {
							this.submitting = false
							uni.reLaunch({ url: `/pages/index/index?code=${this.code}` })
						}
					})
				} catch (e) {
					uni.hideLoading()
					this.submitting = false
					console.error('还车提交失败', e)
					uni.showToast({ title: this.tips.NetError[this.lang], icon: 'none' })
				}
			},
			requestReturnCar() {
				return new Promise((resolve, reject) => {
					uni.request({
						url: RETURN_CAR_URL,
						method: 'POST',
						data: { code: this.code, bak: this.bak },
						header: {
							'content-type': 'application/x-www-form-urlencoded',
							...this.buildHeader()
						},
						timeout: 20000,
						success: (res) => {
							if (res.statusCode === 200 && res.data && res.data.code === 1000) {
								resolve(res.data)
							} else {
								reject(new Error((res.data && res.data.msg) || 'returnCar failed'))
							}
						},
						fail: reject
					})
				})
			}
		}
	}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 24rpx;
		box-sizing: border-box;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16rpx 8rpx 24rpx;
	}

	.back-btn {
		width: 60rpx;
		font-size: 48rpx;
		color: #252c3b;
		text-align: center;
	}

	.header-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #252c3b;
	}

	.header-placeholder {
		width: 60rpx;
	}

	.photo-list {
		flex: 1;
	}

	.photo-btn {
		position: relative;
		height: 240rpx;
		margin-bottom: 24rpx;
		border-radius: 18rpx;
		overflow: hidden;
		background: #ffffff;
		border: 2rpx dashed #c5ccd8;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.photo-btn::after {
		border: none;
	}

	.photo-placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
	}

	.plus {
		font-size: 56rpx;
		color: #b3bac5;
		line-height: 1.2;
	}

	.photo-label {
		font-size: 26rpx;
		color: #8a8f99;
		margin-top: 10rpx;
	}

	.photo-preview {
		width: 100%;
		height: 100%;
	}

	.photo-label-on-img {
		position: absolute;
		left: 20rpx;
		bottom: 16rpx;
		color: #ffffff;
		background: rgba(0, 0, 0, 0.45);
		padding: 6rpx 18rpx;
		border-radius: 20rpx;
		font-size: 22rpx;
	}

	.ctrl-tap {
		opacity: 0.85;
	}

	.remark-section {
		margin-top: 24rpx;
		padding: 20rpx 24rpx;
		background: #ffffff;
		border: 2rpx solid #c5ccd8;
		border-radius: 16rpx;
	}

	.remark-label {
		display: block;
		font-size: 26rpx;
		color: #4a5568;
		margin-bottom: 12rpx;
	}

	.remark-input {
		width: 100%;
		min-height: 140rpx;
		font-size: 26rpx;
		color: #1f2937;
		line-height: 1.5;
		box-sizing: border-box;
	}

	.remark-placeholder {
		color: #b3bac5;
	}

	.submit-btn {
		margin-top: 24rpx;
		width: 100%;
		box-sizing: border-box;
		height: 92rpx;
		line-height: 92rpx;
		background: #4cd964;
		color: #ffffff;
		font-size: 32rpx;
		border-radius: 16rpx;
		border: none;
	}

	.submit-btn::after {
		border: none;
	}

	.submit-btn[disabled] {
		opacity: 0.6;
	}
</style>
