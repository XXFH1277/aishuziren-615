import { Tag } from 'antd';

const typeColor = {
  价格咨询: 'blue',
  规格咨询: 'cyan',
  物流咨询: 'geekblue',
  售后咨询: 'purple',
  优惠咨询: 'magenta',
  商品质疑: 'orange',
  闲聊互动: 'green',
  恶意评论: 'red',
};

export default function CommentTypeTag({ type }) {
  return <Tag color={typeColor[type] || 'default'}>{type}</Tag>;
}
