// utils/request/http.js
// H5 统一请求封装：基于 uni.request，直连线上后端 https://k1sw.wiselink.net.cn

const defaultConfig = {
	url: '',
	method: 'GET',
	timeout: 15000,
	loading: true
}

// 将对象参数转换为 query string
function buildQueryString(params = {}) {
	return Object.keys(params)
		.filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
		.map(key => {
			const value = params[key]
			if (Array.isArray(value)) {
				return value
					.map(item => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`)
					.join('&')
			}
			return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
		})
		.filter(Boolean)
		.join('&')
}

// 前端语种 → 后端 Accept-Language 码；新增语种在此追加映射
const BACKEND_LANG_MAP = {
	zhCn: 'zh_CN',
	enUs: 'en_US',
	esEs: 'es_ES'
}
function toBackendLang(lang) {
	return BACKEND_LANG_MAP[lang] || 'en_US' // 缺省英文
}

class Http {
	constructor(config) {
		this.baseURL = config.baseURL
		this.interceptor = {}
	}

	setInterceptor(interceptor) {
		this.interceptor = interceptor
	}

	async request(config) {
		let mergedConfig = {
			...defaultConfig,
			...config
		}

		if (typeof this.interceptor.request === 'function') {
			mergedConfig = this.interceptor.request(mergedConfig)
		}

		let url = this.baseURL + mergedConfig.url
		if (mergedConfig.params) {
			const params = buildQueryString(mergedConfig.params)
			if (params) url += `?${params}`
		}

		let requestData = mergedConfig.data || {}
		if (mergedConfig.isFormData) {
			const formData = {}
			for (const key in requestData) {
				if (requestData.hasOwnProperty(key)) {
					formData[key] = requestData[key] === undefined || requestData[key] === null
						? ''
						: String(requestData[key])
				}
			}
			requestData = formData
		}

		const response = await uni.request({
			url,
			method: mergedConfig.method,
			data: requestData,
			header: mergedConfig.header,
			timeout: mergedConfig.timeout
		})

		let res = response
		if (typeof this.interceptor.response === 'function') {
			res = this.interceptor.response(response)
		}

		if (res.statusCode === 200) {
			return res.data
		}
		console.error('接口返回异常:', res)
		return Promise.reject(res.data)
	}

	get(url, params, config) {
		return this.request({ ...config, url, method: 'GET', params })
	}

	post(url, data, config) {
		return this.request({ ...config, url, method: 'POST', data })
	}

	postFormData(url, data, config) {
		return this.request({ ...config, url, method: 'POST', data, isFormData: true })
	}
}

// 创建实例：H5 直连线上域名（若浏览器报跨域错误，需后端放行 CORS，或改用开发代理转发）
export const http = new Http({
	baseURL: 'https://k1sw.wiselink.net.cn'
})

http.setInterceptor({
	request: (config) => {
		const language = uni.getStorageSync('language') || 'enUs'
		let header = config.header || {}
		header['funAreaId'] = 1760
		header['lang'] = toBackendLang(language)
		header['content-type'] = config.isFormData
			? 'application/x-www-form-urlencoded'
			: 'application/json'
		config.header = header
		return config
	}
})
