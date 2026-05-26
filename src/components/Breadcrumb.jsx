import { Breadcrumb as AntBreadcrumb } from 'antd';
import { Link, useLocation, useMatches } from 'react-router-dom';

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const matches = useMatches()
    .filter((match) => match.handle?.label)
    .map((match) => ({
      title: match.pathname === '/dashboard' ? (
        <Link to="/dashboard">{match.handle.label}</Link>
      ) : (
        match.handle.label
      ),
    }));

  if (pathname.startsWith('/products/')) {
    const currentLabel = matches[matches.length - 1]?.title || '商品管理';
    return (
      <AntBreadcrumb
        items={[
          { title: '后台' },
          { title: <Link to="/products/list">商品管理</Link> },
          { title: currentLabel },
        ]}
      />
    );
  }

  if (pathname.startsWith('/avatar/')) {
    const currentLabel = matches[matches.length - 1]?.title || '数字人管理';
    return (
      <AntBreadcrumb
        items={[
          { title: '后台' },
          { title: <Link to="/avatar/list">数字人管理</Link> },
          { title: currentLabel },
        ]}
      />
    );
  }

  return <AntBreadcrumb items={matches} />;
}
