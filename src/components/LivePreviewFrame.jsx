import { Tag } from 'antd';

export default function LivePreviewFrame({
  ratio = '9:16 竖屏',
  backgroundColor = '#2563eb',
  title = '直播间预览',
  showAvatar = true,
  showProduct = true,
  showDanmu = true,
  showCoupon = true,
  showLogo = true,
}) {
  const isLandscape = ratio.includes('16:9');

  return (
    <div className={`studio-preview-frame ${isLandscape ? 'is-landscape' : 'is-portrait'}`}>
      <div className="studio-preview-stage" style={{ '--preview-color': backgroundColor }}>
        {showLogo ? <div className="studio-preview-logo">Brand</div> : null}
        <div className="studio-preview-title">{title}</div>
        {showAvatar ? <div className="studio-preview-avatar">数字人站位</div> : null}
        {showProduct ? (
          <div className="studio-preview-product">
            <strong>商品展示区</strong>
            <span>主图 / 卖点 / 库存</span>
          </div>
        ) : null}
        <div className="studio-preview-price">¥99 福利价</div>
        {showCoupon ? <div className="studio-preview-coupon">优惠券贴片</div> : null}
        {showDanmu ? (
          <div className="studio-preview-danmu">
            <Tag color="blue">弹幕</Tag>
            <span>用户提问与互动区域</span>
          </div>
        ) : null}
        <div className="studio-preview-safe">安全区参考线</div>
      </div>
    </div>
  );
}
