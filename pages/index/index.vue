<template>
	<view class="page">
		<!-- 顶部栏：标题 + 语言切换 -->
		<view class="header">
			<view class="header-left">
				<text class="header-title">{{ tips.WiseLinkAutoRide[lang] }}</text>
				<text class="header-sub">Fleet Digital Key</text>
			</view>
			<view class="header-right">
				<picker class="lang-picker" :range="langOptions" range-key="label" :value="langIndex" @change="onLangChange">
					<text class="header-action">{{ currentLangLabel }}</text>
				</picker>
			</view>
		</view>

		<!-- 车辆信息渐变卡 -->
		<view class="profile-card">
			<view class="line">
				<text class="line-label">{{ tips.Brand[lang] }}：</text>
				<text class="line-value">{{ vehicleBrand() }}</text>
			</view>
			<view class="line">
				<text class="line-label">{{ tips.PlateNo[lang] }}：</text>
				<text class="line-value">{{ vehicleInfo.plateNumber || '-' }}</text>
			</view>
			<view class="divider"></view>
			<view class="line">
				<text class="line-label">{{ tips.AuthPeriod[lang] }}：</text>
				<text class="line-value">{{ authPeriodText() }}</text>
			</view>
			<view class="line">
				<text class="line-label">{{ tips.Remark[lang] }}：</text>
				<text class="line-value">{{ vehicleRemark() }}</text>
			</view>
			<view class="line">
				<text class="line-label">{{ tips.Location[lang] }}：</text>
				<text class="line-value">{{ vehicleAddress() }}</text>
			</view>
			<view class="line">
				<text class="line-label">{{ tips.LocationTime[lang] }}：</text>
				<text class="line-value">{{ fetchedAt || '-' }}</text>
			</view>
		</view>

		<!-- 弹性留白：上部下沉，底部操作组贴底 -->
		<view class="spacer"></view>

		<!-- 车辆照片胶囊条 -->
		<view class="photo-bar" hover-class="item-tap" @tap="viewPhotos">
			<text class="photo-bar-title">{{ tips.VehiclePhotos[lang] }}</text>
			<text class="photo-bar-link">{{ tips.View[lang] }} ›</text>
		</view>

		<!-- 三个圆形控车按钮：鸣笛寻车 / 开锁 / 关锁 -->
		<view class="circle-row">
			<view class="circle-item" hover-class="item-tap" @tap="controlCar(5)">
				<view class="circle circle-honk"><view class="circle-icon icon-honk"></view></view>
				<text class="circle-label">{{ tips.FindVehicle[lang] }}</text>
			</view>
			<view class="circle-item" hover-class="item-tap" @tap="controlCar(3)">
				<view class="circle circle-unlock"><view class="circle-icon icon-unlock"></view></view>
				<text class="circle-label">{{ tips.Unlock[lang] }}</text>
			</view>
			<view class="circle-item" hover-class="item-tap" @tap="controlCar(1)">
				<view class="circle circle-lock"><view class="circle-icon icon-lock"></view></view>
				<text class="circle-label">{{ tips.Lock[lang] }}</text>
			</view>
		</view>

		<!-- 还车大胶囊按钮 -->
		<button class="return-btn" hover-class="btn-tap" @tap="goReturn">{{ tips.ReturnVehicle[lang] }}</button>
	</view>
</template>

<script>
import { u_getCarPoisitonByCode, u_operation } from '@/api'
import { tips } from '@/utils/langtips.js'
import { parseUrlParams } from '@/utils/urlParams.js'
import { LANG_OPTIONS, langIndexOf } from '@/utils/langOptions.js'

// 历史车辆照片资源域名（沿用 MCCKey）
const PHOTO_BASE = 'https://k3a.wiselink.net.cn/img/'

export default {
	data() {
		return {
			tips,
			langOptions: LANG_OPTIONS,
			lang: 'enUs',
			linkCode: '',
			vehicleInfo: {},
			controlcode: '',
			fetchedAt: '',
			loading: false
		}
	},
	// 分享链接参数：?code=控制码；兼容根路径 query（www.xxx.com?code=xxx）
	onLoad(options = {}) {
		const params = parseUrlParams(options)
		this.linkCode = params.code || params.controlcode || ''
	},
	onShow() {
		this.initLang()
		this.resolveVehicle()
	},
	computed: {
		langIndex() {
			return langIndexOf(this.lang)
		},
		currentLangLabel() {
			return this.langOptions[this.langIndex].label
		}
	},
	methods: {
		initLang() {
			const cached = uni.getStorageSync('language')
			// 默认英文（清单第一项）；缓存非法时回退默认
			this.lang = LANG_OPTIONS[langIndexOf(cached)].value
		},
		onLangChange(e) {
			const opt = this.langOptions[e.detail.value] || this.langOptions[0]
			this.lang = opt.value
			uni.setStorageSync('language', this.lang)
			// 语言切换后自动刷新车辆信息：后端按 lang 请求头返回对应语言的品牌/备注/地址等字段，
			// 重新请求可让数据与界面文案语言一致，无需手动刷新页面
			if (this.controlcode) {
				this.fetchCarInfo(this.controlcode)
			}
		},
		// 车辆来源：链接控制码直连 > 空态
		async resolveVehicle() {
			if (this.linkCode) {
				this.controlcode = this.linkCode
				await this.fetchCarInfo(this.linkCode)
				return
			}
			this.vehicleInfo = {}
			this.controlcode = ''
			this.fetchedAt = ''
		},
		// 按控制码取车辆信息
		async fetchCarInfo(code) {
			try {
				const res = await u_getCarPoisitonByCode({ code })
				if (res && res.code == 1000 && res.content) {
					this.vehicleInfo = res.content
					this.fetchedAt = this.formatDateTime(new Date())
				}
			} catch (e) {
				console.error('获取车辆信息失败', e)
			}
		},
		// 字段取值兼容：品牌
		vehicleBrand() {
			const v = this.vehicleInfo || {}
			return v.brand || v.model || v.carBrand || v.vehicleModel || '-'
		},
		// 字段取值兼容：文本地址优先，缺省退化为经纬度
		vehicleAddress() {
			const v = this.vehicleInfo || {}
			if (v.address) return v.address
			if (v.locationText) return v.locationText
			return this.formatLocation(v.latitude, v.longitude)
		},
		authPeriodText() {
			const v = this.vehicleInfo || {}
			return `${v.startDate || '-'} - ${v.endDate || '-'}`
		},
		// 备注：优先取 bak（与后端字段约定一致），并兼容其他历史字段名
		vehicleRemark() {
			const v = this.vehicleInfo || {}
			const remark = v.bak || v.remark || v.remarks || v.note || v.memo || v.description || v.comments || v.remarkText
			return (remark === undefined || remark === null || remark === '') ? '-' : String(remark)
		},
		formatLocation(lat, lng) {
			if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') {
				return '-'
			}
			return `${lat}, ${lng}`
		},
		formatDateTime(d) {
			const p = n => String(n).padStart(2, '0')
			return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
		},
		// 云端远程控车：operationType 1=关锁 3=开锁 5=鸣笛寻车
		async controlCar(operationType) {
			if (!this.vehicleInfo.sn) {
				uni.showToast({ title: this.tips.NoVehicle[this.lang], icon: 'none' })
				return
			}
			if (this.loading) return
			this.loading = true
			uni.showLoading({ title: this.tips.Loading[this.lang], mask: true })
			try {
				const res = await u_operation({
					sn: this.vehicleInfo.sn,
					operationType,
					code: this.controlcode,
					_timestamp: Date.now()
				})
				uni.hideLoading()
				this.loading = false
				uni.showModal({
					title: this.tips.Tip[this.lang],
					// 业务成功（code===1000）显示本地三语文案，避免后端中文 msg 透出；失败时保留后端具体信息
					content: (res && res.code == 1000)
						? this.tips.OperateSuccess[this.lang]
						: ((res && res.msg) || this.tips.OperateSuccess[this.lang]),
					showCancel: false,
					confirmText: this.tips.Confirm[this.lang]
				})
			} catch (e) {
				uni.hideLoading()
				this.loading = false
				uni.showToast({ title: this.tips.NetError[this.lang], icon: 'none' })
			}
		},
		// 查看车辆历史照片
		viewPhotos() {
			const fields = [
				this.vehicleInfo.uploadImgUrl,
				this.vehicleInfo.uploadImgUrlTwo,
				this.vehicleInfo.uploadImgUrlThree,
				this.vehicleInfo.uploadImgUrlFour,
				this.vehicleInfo.uploadImgUrlFive
			]
			const urls = fields.filter(Boolean).map(path => PHOTO_BASE + String(path).replace(/\\/g, '/'))
			if (!urls.length) {
				uni.showToast({ title: this.tips.NoPhotos[this.lang], icon: 'none' })
				return
			}
			uni.previewImage({ urls, current: urls[0] })
		},
		// 跳转还车拍照页
		goReturn() {
			if (!this.controlcode) {
				uni.showToast({ title: this.tips.NoVehicle[this.lang], icon: 'none' })
				return
			}
			uni.navigateTo({ url: `/pages/returnPhotos/index?code=${this.controlcode}` })
		}
	}
}
</script>

<style scoped>
	.page {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 28rpx 28rpx 32rpx;
		box-sizing: border-box;
		background: linear-gradient(165deg, #f1ecfb 0%, #e9f3ec 55%, #eef2fa 100%);
	}

	.spacer {
		flex: 1;
		min-height: 40rpx;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24rpx 8rpx 44rpx;
	}

	.header-left {
		display: flex;
		flex-direction: column;
	}

	.header-title {
		font-size: 38rpx;
		font-weight: 600;
		color: #312d52;
		letter-spacing: 0.5rpx;
	}

	.header-sub {
		font-size: 22rpx;
		color: #8a85ab;
		margin-top: 8rpx;
		letter-spacing: 1rpx;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 16rpx;
	}

	.header-action {
		font-size: 26rpx;
		color: #5b5578;
		padding: 10rpx 22rpx;
		border: 1rpx solid #dfd9f0;
		border-radius: 28rpx;
		background: #ffffff;
		line-height: 1.4;
		box-shadow: 0 4rpx 12rpx rgba(60, 50, 120, 0.06);
	}

	.lang-picker {
		display: inline-flex;
		align-items: center;
	}

	/* 车辆信息淡紫渐变卡 */
	.profile-card {
		margin-top: 18rpx;
		background: linear-gradient(135deg, #f5f0fc 0%, #eef7f1 100%);
		border: 1rpx solid #e4ddf4;
		border-radius: 32rpx;
		padding: 46rpx 36rpx;
		display: flex;
		flex-direction: column;
		gap: 36rpx;
		box-shadow: 0 14rpx 34rpx rgba(60, 50, 120, 0.08);
	}

	.line {
		display: flex;
		align-items: baseline;
	}

	.line-label {
		font-size: 28rpx;
		color: #8b86a8;
		flex-shrink: 0;
	}

	.line-value {
		font-size: 28rpx;
		color: #2e2a4e;
		font-weight: 500;
		flex: 1;
		word-break: break-all;
	}

	.divider {
		height: 1rpx;
		background: #e8e3f5;
	}

	/* 车辆照片淡绿胶囊条 */
	.photo-bar {
		margin-bottom: 36rpx;
		display: flex;
		justify-content: space-between;
		align-items: center;
		background: linear-gradient(90deg, #f3fbf6, #f2f6fd);
		border: 1rpx solid #dfeee5;
		border-radius: 40rpx;
		padding: 32rpx 36rpx;
		box-shadow: 0 8rpx 20rpx rgba(60, 50, 120, 0.06);
	}

	.photo-bar-title {
		font-size: 28rpx;
		color: #4a4569;
	}

	.photo-bar-link {
		font-size: 28rpx;
		color: #0e9f8a;
		font-weight: 500;
	}

	/* 圆形控车按钮 */
	.circle-row {
		margin-bottom: 48rpx;
		display: flex;
		justify-content: space-around;
	}

	.circle-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20rpx;
	}

	.circle {
		width: 136rpx;
		height: 136rpx;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 12rpx 26rpx rgba(60, 50, 120, 0.16);
	}

	.circle-honk {
		background: linear-gradient(135deg, #1fd6b2, #0d9e8a);
	}

	.circle-unlock {
		background: linear-gradient(135deg, #f79a6f, #df542e);
	}

	.circle-lock {
		background: linear-gradient(135deg, #93a9c6, #5a76a0);
	}

	.circle-icon {
		width: 58rpx;
		height: 58rpx;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}

	.icon-honk {
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z'/></svg>");
	}

	.icon-unlock {
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6h1.9c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm0 12H6V10h12v10z'/></svg>");
	}

	.icon-lock {
		background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='white'><path d='M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9zm3 5a1.6 1.6 0 0 0-1 2.9V21h2v-1.1A1.6 1.6 0 0 0 12 15z'/></svg>");
	}

	.circle-label {
		font-size: 26rpx;
		color: #494465;
	}

	/* 还车大胶囊按钮（浅香槟金） */
	.return-btn {
		margin-bottom: 12rpx;
		width: 100%;
		box-sizing: border-box;
		height: 96rpx;
		line-height: 96rpx;
		border-radius: 48rpx;
		background: linear-gradient(90deg, #eed189, #d2a24c);
		color: #ffffff;
		font-size: 32rpx;
		font-weight: 600;
		border: none;
		box-shadow: 0 12rpx 26rpx rgba(210, 162, 76, 0.25);
	}

	.return-btn::after {
		border: none;
	}

	.btn-tap {
		opacity: 0.85;
	}

	.item-tap {
		opacity: 0.85;
	}
</style>
