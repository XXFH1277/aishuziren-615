import { Result, Spin, message } from 'antd';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import ProductForm, { mapProductToFormValues } from '../../components/ProductForm';
import { getProductById } from '../../services/productService';

export default function EditProduct() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchProduct() {
      setLoading(true);
      setError('');

      try {
        const data = await getProductById(id);
        if (active) {
          setProduct(data);
        }
      } catch (requestError) {
        const messageText = requestError.message || '商品详情加载失败';
        if (active) {
          setError(messageText);
        }
        message.error(messageText);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchProduct();

    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return <Spin tip="正在加载商品详情..." />;
  }

  if (error || !product) {
    return <Result status="404" title="未找到商品" subTitle={error || '本地 API 中未找到对应商品。'} />;
  }

  return (
    <>
      <PageHeader
        title="编辑商品"
        description="编辑单个商品的完整资料，当前详情读取自本地 API / SQLite。AI 文案能力仍为 Mock。"
      />
      <ProductForm mode="edit" productId={product.id} initialValues={mapProductToFormValues(product)} productName={product.name} />
    </>
  );
}
