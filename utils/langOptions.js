// 支持语种清单（下拉选择数据源）
// 后续新增语种步骤：
// 1. 在下方数组追加 { value: 'xxXX', label: '语种显示名' }（value 与缓存 language、字典键保持一致）；
// 2. 在 utils/langtips.js 每个文案键对象内补充对应语种文案；
// 3. 在 utils/request/http.js 的 LANG_MAP 中补充后端语言码映射。
export const LANG_OPTIONS = [
	{ value: 'enUs', label: 'English' },
	{ value: 'zhCn', label: '中文' },
	{ value: 'esEs', label: 'Español' }
]

// 由语种 value 取下拉索引；非法值回退到第一项（默认英文）
export function langIndexOf(value) {
	const idx = LANG_OPTIONS.findIndex(o => o.value === value)
	return idx < 0 ? 0 : idx
}

// 由语种 value 取显示名
export function langLabelOf(value) {
	return LANG_OPTIONS[langIndexOf(value)].label
}
