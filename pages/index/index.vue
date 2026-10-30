<template>
	<view class="page">
		<!-- 背景氛围光斑 -->
		<view class="glow glow-a"></view>
		<view class="glow glow-b"></view>

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

		<!-- 车辆信息卡：车牌主视觉 + 字段分层 -->
		<view class="profile-card">
			<view class="card-accent"></view>

			<view class="plate-block">
				<text class="plate-tag">{{ tips.PlateNo[lang] }}</text>
				<text class="plate-value">{{ vehicleInfo.plateNumber || '-' }}</text>
			</view>

			<view class="divider"></view>

			<view class="field">
				<text class="field-label">{{ tips.Brand[lang] }}</text>
				<text class="field-value">{{ vehicleBrand() }}</text>
			</view>
			<view class="field">
				<text class="field-label">{{ tips.AuthPeriod[lang] }}</text>
				<view class="period">
					<text class="period-item">{{ periodStart() }}</text>
					<text class="period-item">{{ periodEnd() }}</text>
				</view>
			</view>
			<view class="field">
				<text class="field-label">{{ tips.Remark[lang] }}</text>
				<text class="field-value">{{ vehicleRemark() }}</text>
			</view>
			<view class="field">
				<text class="field-label">{{ tips.Location[lang] }}</text>
				<text class="field-value">{{ resolvedAddress || vehicleAddress() }}</text>
			</view>
			<view class="field">
				<text class="field-label">{{ tips.LocationTime[lang] }}</text>
				<text class="field-value muted">{{ fetchedAt || '-' }}</text>
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
			// 经纬度逆地理解析出的地址文本（按当前语言），为空时回退后端 address/坐标
			resolvedAddress: '',
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
			// 经纬度地址按新语言重新解析
			this.resolveAddress()
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
					// 拿到坐标后异步逆地理解析地址（按当前语言）
					this.resolveAddress()
				}
			} catch (e) {
				console.error('获取车辆信息失败', e)
			}
		},
		// 字段取值兼容：品牌（业务口径 = vehicleSerialName + vehicleModeName，兼容其他历史字段）
		vehicleBrand() {
			const v = this.vehicleInfo || {}
			const parts = [v.vehicleSerialName, v.vehicleModeName].filter(Boolean)
			if (parts.length) return parts.join(' ')
			return v.brand || v.model || v.carBrand || v.vehicleModel || '-'
		},
		// 字段取值兼容：文本地址优先，缺省退化为经纬度
		vehicleAddress() {
			const v = this.vehicleInfo || {}
			if (v.address) return v.address
			if (v.locationText) return v.locationText
			return this.formatLocation(v.latitude, v.longitude)
		},
		// 经纬度逆地理解析为地址文本（按当前语言；主：OpenStreetMap Nominatim，备：BigDataCloud，均免 Key）
		resolveAddress() {
			const v = this.vehicleInfo || {}
			const lat = v.latitude
			const lng = v.longitude
			if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') {
				this.resolvedAddress = ''
				return
			}
			const langCode = { zhCn: 'zh-CN', enUs: 'en', esEs: 'es' }[this.lang] || 'en'
			const cacheKey = `${lat},${lng}|${langCode}`
			// 同坐标同语言结果缓存，避免重复请求
			this._geoCache = this._geoCache || {}
			if (this._geoCache[cacheKey]) {
				this.resolvedAddress = this._geoCache[cacheKey]
				return
			}
			const apply = (text) => {
				const addr = (text || '').trim()
				this.resolvedAddress = addr || ''
				this._geoCache[cacheKey] = addr
			}
			uni.request({
				url: `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=${langCode}&zoom=16`,
				method: 'GET',
				timeout: 8000,
				success: (res) => {
					if (res.statusCode === 200 && res.data && res.data.display_name) {
						// 去掉国别层、最多保留 4 段，避免地址过长
						const parts = String(res.data.display_name).split(',').map(s => s.trim()).filter(Boolean)
						const filtered = parts.filter(s => !/^(中国|China|People'?s Republic of China)$/.test(s))
						apply(filtered.slice(0, 4).join(', '))
					} else {
						this.geoFallback(lat, lng, langCode, apply)
					}
				},
				fail: () => this.geoFallback(lat, lng, langCode, apply)
			})
		},
		geoFallback(lat, lng, langCode, apply) {
			uni.request({
				url: `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${langCode}`,
				method: 'GET',
				timeout: 8000,
				success: (res) => {
					if (res.statusCode === 200 && res.data) {
						const d = res.data
						const parts = [d.locality, d.city, d.principalSubdivision, d.countryName]
						apply(parts.filter(Boolean).join(', '))
					} else {
						apply('')
					}
				},
				fail: () => apply('')
			})
		},
		authPeriodText() {
			const v = this.vehicleInfo || {}
			return `${v.startDate || '-'} - ${v.endDate || '-'}`
		},
		// 授权时段拆起/止两行展示
		periodStart() {
			const v = this.vehicleInfo || {}
			return v.startDate || '-'
		},
		periodEnd() {
			const v = this.vehicleInfo || {}
			return v.endDate || '-'
		},
		// 备注：只取 bak（后端字段约定）
		vehicleRemark() {
			const v = this.vehicleInfo || {}
			const remark = v.bak
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
		position: relative;
		overflow: hidden;
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		padding: 28rpx 28rpx 32rpx;
		box-sizing: border-box;
		background: linear-gradient(165deg, #f1ecfb 0%, #eef4fb 35%, #e9f3ec 70%, #eef2fa 100%);
	}

	/* 背景氛围光斑 */
	.glow {
		position: absolute;
		border-radius: 50%;
		pointer-events: none;
	}

	.glow-a {
		top: -160rpx;
		right: -180rpx;
		width: 560rpx;
		height: 560rpx;
		background: radial-gradient(closest-side, rgba(168, 138, 214, 0.30), rgba(168, 138, 214, 0) 72%);
	}

	.glow-b {
		bottom: 220rpx;
		left: -200rpx;
		width: 520rpx;
		height: 520rpx;
		background: radial-gradient(closest-side, rgba(60, 196, 160, 0.22), rgba(60, 196, 160, 0) 72%);
	}

	.spacer {
		flex: 1;
		min-height: 40rpx;
	}

	.header {
		position: relative;
		z-index: 1;
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

	/* 车辆信息卡：顶部渐变装饰条 + 信息分层 */
	.profile-card {
		position: relative;
		z-index: 1;
		overflow: hidden;
		margin-top: 18rpx;
		background: #ffffff;
		border: 1rpx solid #e4ddf4;
		border-radius: 32rpx;
		padding: 44rpx 36rpx 40rpx;
		display: flex;
		flex-direction: column;
		box-shadow: 0 14rpx 34rpx rgba(60, 50, 120, 0.08);
	}

	.card-accent {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 8rpx;
		background: linear-gradient(90deg, #a88ad6, #7fcfb2);
	}

	/* 车牌主视觉 */
	.plate-block {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14rpx;
	}

	.plate-tag {
		display: inline-flex;
		align-items: center;
		padding: 6rpx 16rpx;
		border-radius: 10rpx;
		background: rgba(168, 138, 214, 0.14);
		color: #8b6cc2;
		font-size: 20rpx;
		letter-spacing: 2rpx;
	}

	.plate-value {
		font-size: 44rpx;
		font-weight: 700;
		color: #2e2a4e;
		letter-spacing: 1rpx;
		word-break: break-all;
	}

	.divider {
		height: 1rpx;
		background: #eef0f8;
		margin: 34rpx 0;
	}

	/* 字段行：左标签 + 右值 */
	.field {
		display: flex;
		align-items: flex-start;
		gap: 28rpx;
		margin-bottom: 30rpx;
	}

	.field:last-child {
		margin-bottom: 0;
	}

	.field-label {
		flex-shrink: 0;
		width: 170rpx;
		font-size: 22rpx;
		color: #a29cc2;
		letter-spacing: 1rpx;
		line-height: 1.6;
		padding-top: 4rpx;
	}

	.field-value {
		flex: 1;
		font-size: 30rpx;
		color: #2e2a4e;
		font-weight: 500;
		line-height: 1.6;
		word-break: break-all;
	}

	.field-value.muted {
		color: #8a85ab;
		font-size: 26rpx;
		font-weight: 400;
	}

	/* 授权时段：起止两行 */
	.period {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 8rpx;
	}

	.period-item {
		font-size: 28rpx;
		color: #2e2a4e;
		font-weight: 500;
		line-height: 1.5;
		word-break: break-all;
	}

	/* 车辆照片淡绿胶囊条 */
	.photo-bar {
		position: relative;
		z-index: 1;
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
		position: relative;
		z-index: 1;
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
		position: relative;
		z-index: 1;
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
