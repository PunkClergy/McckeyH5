import { http } from '@/utils/request/http'

// ===== H5 核心闭环接口（直连 https://k1sw.wiselink.net.cn）=====

// 1. 按手机号获取车辆控制码列表 GET
export const u_getControlCodeByMobile = (data) => http.get('/renterApi/getControlCodeByMobile', data)

// 2. 按控制码获取车辆信息（含 SN、车牌、位置、授权时间、照片）POST form
export const u_getCarPoisitonByCode = (data) => http.postFormData('/renterApi/getCarPoisitonByCode', data)

// 3. 云端远程控车 POST form：operationType 1=关锁 3=开锁 5=鸣笛寻车
export const u_operation = (data) => http.postFormData('/renterApi/operation', data)

// ===== 还车页直写请求接口（不走封装，见 pages/returnPhotos/index.vue）=====
// 4. 照片上传   POST multipart/form-data  https://k1sw.wiselink.net.cn/renterApi/saveImg
// 5. 提交还车   POST form-urlencoded     https://k1sw.wiselink.net.cn/renterApi/returnCar
