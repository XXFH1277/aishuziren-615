import { Result } from 'antd';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ProductForm, { mapProductToFormValues } from '../../components/ProductForm';
import { getProductById } from '../../services/productService';

export default function EditProduct() {
  const { id } = useParams();
  const product = getProductById(id);

  if (!product) {
    return <Result status="404" title="未找到商品" subTitle="当前编辑页只读取本地 Mock 商品数据。" />;
  }

  return (
    <>
      <PageHeader
        title="编辑商品"
        description="编辑单个商品的完整资料。AI 文案能力嵌入在各个标签页字段旁边，当前只生成 Mock 文案。"
      />
      <ProductForm mode="edit" initialValues={mapProductToFormValues(product)} productName={product.name} />
    </>
  );
}
