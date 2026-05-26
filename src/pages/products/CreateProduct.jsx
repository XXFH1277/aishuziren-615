import PageHeader from '../../components/PageHeader';
import ProductForm from '../../components/ProductForm';

export default function CreateProduct() {
  return (
    <>
      <PageHeader
        title="创建商品"
        description="创建单个商品，并在页内维护基础信息、规格价格、卖点、直播话术、FAQ 和合规限制。"
      />
      <ProductForm mode="create" />
    </>
  );
}
