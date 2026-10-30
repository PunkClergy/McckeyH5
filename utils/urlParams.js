// 统一解析 URL 入口参数：合并 uni 页面 options、location.search、location.hash 内 query
// 兼容三种分发形态：
//   1) https://host/?code=xxx                          （history 模式 / 根路径 query）
//   2) https://host/?code=xxx#/pages/index/index      （hash 模式，参数在 hash 之前）
//   3) https://host/#/pages/index/index?code=xxx      （hash 模式，参数在 hash 之内）
// options（uni 页面参数）优先级最高，search / hash 仅补漏
export function parseUrlParams(options = {}) {
	const out = {}
	for (const key in options) {
		if (Object.prototype.hasOwnProperty.call(options, key)) {
			out[key] = options[key]
		}
	}
	try {
		if (typeof window === 'undefined' || !window.location) return out
		const loc = window.location
		const segments = [loc.search ? loc.search.replace(/^\?/, '') : '']
		const hash = loc.hash || ''
		const qi = hash.indexOf('?')
		if (qi > -1) segments.push(hash.slice(qi + 1))
		segments.join('&').replace(/([^&=]+)=([^&]*)/g, (_, rawKey, rawVal) => {
			const key = decodeURIComponent(rawKey)
			const val = decodeURIComponent(rawVal || '')
			if (!(key in out)) out[key] = val
		})
	} catch (e) {
		console.warn('[urlParams] parse failed', e)
	}
	return out
}
