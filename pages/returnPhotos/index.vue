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

	// 上传前压缩参数：长边上限 1600px、JPEG 质量 0.82
	// 手机原图通常 3~8MB，压缩后约 250~450KB，上传耗时下降一个数量级
	const MAX_SIDE = 1600
	const QUALITY = 0.82
	// 小于此体积的图不再重编码，避免二次失真
	const MIN_COMPRESS_BYTES = 500 * 1024
	// 单张上传超时（毫秒）与失败重试次数
	const UPLOAD_TIMEOUT = 30000
	const UPLOAD_MAX_RETRY = 2

	export default {
		data() {
			return {
				tips,
				lang: 'enUs',
				code: '',
				submitting: false,
				// 5 张照片：字段名与后端约定 img1Arr ~ img5Arr 保持一致
				// path 预览地址；ownUrl 仅记录本页压缩生成的 blob 地址（用于精确释放）；blob 上传用
				photoItems: [
					{ key: 0, field: 'img1Arr', tipKey: 'FrontPhoto', path: '', originPath: '', ownUrl: '', blob: null, size: 0, originSize: 0 },
					{ key: 1, field: 'img2Arr', tipKey: 'RearPhoto', path: '', originPath: '', ownUrl: '', blob: null, size: 0, originSize: 0 },
					{ key: 2, field: 'img3Arr', tipKey: 'LeftPhoto', path: '', originPath: '', ownUrl: '', blob: null, size: 0, originSize: 0 },
					{ key: 3, field: 'img4Arr', tipKey: 'RightPhoto', path: '', originPath: '', ownUrl: '', blob: null, size: 0, originSize: 0 },
					{ key: 4, field: 'img5Arr', tipKey: 'KeyPhoto', path: '', originPath: '', ownUrl: '', blob: null, size: 0, originSize: 0 }
				],
				// 还车备注（选填，字段名 bak 与后端约定一致），随 returnCar 一并提交
				bak: ''
			}
		},
		onLoad(options) {
			this.code = (options && options.code) || ''
			this.initLang()
		},
		onUnload() {
			// 页面销毁时释放本页压缩生成的 blob 地址
			this.photoItems.forEach((item) => this.revokeOwnUrl(item))
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
				// 提交上传过程中不允许再改图，避免上传对象与界面不一致
				if (this.submitting) return
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['album', 'camera'],
					success: async (res) => {
						const originPath = res.tempFilePaths && res.tempFilePaths[0]
						if (!originPath) return
						// 重新选图时释放上一张由本页压缩生成的临时地址
						this.revokeOwnUrl(item)
						// 大图重编码需要时间，给个轻量反馈
						uni.showLoading({ title: this.tips.Loading[this.lang], mask: true })
						const pickedFile = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].file
						// H5 下 sizeType 不生效，这里统一走 Canvas 压缩到长边 1600px / q0.82
						const packed = await this.compressToTarget(originPath, pickedFile)
						uni.hideLoading()
						item.originPath = originPath
						item.blob = packed.blob || null
						item.path = packed.path || originPath
						item.ownUrl = packed.ownUrl || ''
						item.size = packed.size || 0
						item.originSize = packed.originSize || 0
						if (item.originSize && item.size) {
							console.log('[photo] 压缩 ' + Math.round(item.originSize / 1024) + 'KB -> ' + Math.round(item.size / 1024) + 'KB')
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
			/* ===== 上传前压缩（H5 Canvas 重编码） ===== */
			// 只释放本页压缩生成的 blob 地址，不动 uni 自己的预览地址
			revokeOwnUrl(item) {
				if (item && item.ownUrl && item.ownUrl.indexOf('blob:') === 0) {
					try { URL.revokeObjectURL(item.ownUrl) } catch (e) {}
					item.ownUrl = ''
				}
			},
			async compressToTarget(path, pickedFile) {
				// 非 H5 或环境不支持，直接走原图
				if (typeof document === 'undefined') {
					return { path, blob: null, size: 0, originSize: 0 }
				}
				let blob = null
				// 优先直接用 chooseImage 返回的原始 File，省一次网络读取
				if (pickedFile && typeof pickedFile.size === 'number' && pickedFile.size > 0) {
					blob = pickedFile
				} else if (typeof fetch !== 'undefined') {
					try {
						blob = await (await fetch(path)).blob()
					} catch (e) {
						return { path, blob: null, size: 0, originSize: 0 }
					}
				} else {
					return { path, blob: null, size: 0, originSize: 0 }
				}
				const originSize = blob.size
				// 体积本来就小，避免无谓重编码
				if (originSize <= MIN_COMPRESS_BYTES) {
					return { path, blob, size: originSize, originSize }
				}
				const out = await this.shrinkImage(blob)
				// 压缩失败或结果反而更大，回退原图
				if (!out || out.size >= originSize) {
					return { path, blob, size: originSize, originSize }
				}
				const url = URL.createObjectURL(out)
				return { path: url, ownUrl: url, blob: out, size: out.size, originSize }
			},
			// 按长边上限等比缩放，再以 JPEG 重编码
			shrinkImage(blob) {
				return new Promise((resolve) => {
					const objectUrl = URL.createObjectURL(blob)
					const img = new Image()
					img.onload = () => {
						try {
							const iw = img.naturalWidth || img.width
							const ih = img.naturalHeight || img.height
							const scale = Math.min(1, MAX_SIDE / Math.max(iw, ih))
							const w = Math.max(1, Math.round(iw * scale))
							const h = Math.max(1, Math.round(ih * scale))
							const canvas = document.createElement('canvas')
							canvas.width = w
							canvas.height = h
							canvas.getContext('2d').drawImage(img, 0, 0, w, h)
							canvas.toBlob((out) => {
								URL.revokeObjectURL(objectUrl)
								resolve(out || null)
							}, 'image/jpeg', QUALITY)
						} catch (e) {
							URL.revokeObjectURL(objectUrl)
							resolve(null)
						}
					}
					img.onerror = () => {
						URL.revokeObjectURL(objectUrl)
						resolve(null)
					}
					img.src = objectUrl
				})
			},
			// 把网络类失败标记为可重试
			markRetryable(err) {
				if (err && typeof err === 'object') {
					err.retryable = true
					return err
				}
				return Object.assign(new Error(String(err)), { retryable: true })
			},
			delay(ms) {
				return new Promise((resolve) => setTimeout(resolve, ms))
			},
			// 单张上传 + 退避重试（仅网络类失败重试，业务失败直接抛出）
			async uploadOnePhotoWithRetry(item) {
				let attempt = 0
				while (attempt <= UPLOAD_MAX_RETRY) {
					try {
						return await this.uploadOnePhoto(item)
					} catch (e) {
						const retryable = e && e.retryable
						attempt += 1
						if (!retryable || attempt > UPLOAD_MAX_RETRY) throw e
						console.warn('[photo] 上传失败，第 ' + attempt + ' 次重试', e)
						await this.delay(500 * attempt)
					}
				}
			},
			// 单张上传：优先用压缩后的 Blob + 原生 XHR（可控超时），否则回退 uni.uploadFile
			uploadOnePhoto(item) {
				if (item.blob && typeof XMLHttpRequest !== 'undefined') {
					return this.uploadBlobByXhr(item)
				}
				return new Promise((resolve, reject) => {
					uni.uploadFile({
						url: SAVE_IMG_URL,
						filePath: item.path,
						name: item.field,
						formData: { code: this.code },
						header: this.buildHeader(),
						timeout: UPLOAD_TIMEOUT,
						success: (res) => {
							try {
								const data = JSON.parse(res.data)
								if (res.statusCode === 200 && Number(data.code) === 1000) {
									resolve(data)
								} else {
									// 业务码非成功，不重试
									reject(new Error(data.msg || 'upload failed'))
								}
							} catch (e) {
								reject(this.markRetryable(e))
							}
						},
						fail: (err) => {
							reject(this.markRetryable(err))
						}
					})
				})
			},
			// 原生 XHR 上传 Blob：可设置超时，并按 5 张总量给出进度
			uploadBlobByXhr(item) {
				return new Promise((resolve, reject) => {
					const xhr = new XMLHttpRequest()
					xhr.open('POST', SAVE_IMG_URL, true)
					// 不手写 content-type，交给浏览器自动生成 multipart boundary
					const header = this.buildHeader()
					Object.keys(header).forEach((k) => xhr.setRequestHeader(k, header[k]))
					xhr.timeout = UPLOAD_TIMEOUT
					xhr.onload = () => {
						let data = null
						try {
							data = JSON.parse(xhr.responseText)
						} catch (e) {
							reject(this.markRetryable(e))
							return
						}
						if (xhr.status === 200 && data && Number(data.code) === 1000) {
							resolve(data)
						} else {
							reject(new Error((data && data.msg) || 'upload failed'))
						}
					}
					xhr.onerror = () => reject(this.markRetryable(new Error('network error')))
					xhr.ontimeout = () => reject(this.markRetryable(new Error('upload timeout')))
					xhr.onabort = () => reject(this.markRetryable(new Error('upload aborted')))
					const fd = new FormData()
					// 文件名固定带 .jpg，后端按扩展名落盘
					fd.append(item.field, item.blob, item.field + '.jpg')
					fd.append('code', this.code)
					xhr.send(fd)
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
				const total = this.photoItems.length
				try {
					// 逐张串行上传：避免 5 张抢同一上行带宽互相拖慢，并实时显示「第 n/5 张」
					for (let i = 0; i < total; i++) {
						uni.showLoading({ title: `${i + 1}/${total}`, mask: true })
						await this.uploadOnePhotoWithRetry(this.photoItems[i])
					}
					uni.showLoading({ title: this.tips.Uploading[this.lang], mask: true })
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
							if (res.statusCode === 200 && res.data && Number(res.data.code) === 1000) {
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
		background: linear-gradient(165deg, #f1ecfb 0%, #e9f3ec 55%, #eef2fa 100%);
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
		color: #312d52;
		text-align: center;
	}

	.header-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #312d52;
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
		border: 2rpx dashed #d6cfe9;
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
		color: #b0a8cc;
		line-height: 1.2;
	}

	.photo-label {
		font-size: 26rpx;
		color: #8a85ab;
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
		background: rgba(0, 0, 0, 0.5);
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
		border: 1rpx solid #dfd9f0;
		border-radius: 16rpx;
	}

	.remark-label {
		display: block;
		font-size: 26rpx;
		color: #4a4569;
		margin-bottom: 12rpx;
	}

	.remark-input {
		width: 100%;
		min-height: 140rpx;
		font-size: 26rpx;
		color: #2e2a4e;
		line-height: 1.5;
		box-sizing: border-box;
	}

	.remark-placeholder {
		color: #a8a2c2;
	}

	/* 提交还车按钮（浅香槟金） */
	.submit-btn {
		margin-top: 24rpx;
		width: 100%;
		box-sizing: border-box;
		height: 92rpx;
		line-height: 92rpx;
		background: linear-gradient(90deg, #eed189, #d2a24c);
		color: #ffffff;
		font-size: 32rpx;
		border-radius: 16rpx;
		border: none;
		box-shadow: 0 12rpx 26rpx rgba(210, 162, 76, 0.25);
	}

	.submit-btn::after {
		border: none;
	}

	.submit-btn[disabled] {
		opacity: 0.6;
	}
</style>
