import { Breadcrumb as AntBreadcrumb } from 'antd';
import { Link, useLocation, useMatches } from 'react-router-dom';

const moduleBreadcrumbs = [
  { prefix: '/products/', link: '/products/list', label: '商品管理' },
  { prefix: '/live/', link: '/live/rooms', label: '直播管理' },
  { prefix: '/avatar/', link: '/avatar/list', label: '数字人管理' },
  { prefix: '/studio/', link: '/studio/background', label: '直播间搭建' },
  { prefix: '/interaction/', link: '/interaction/comments', label: '互动播控' },
  { prefix: '/delay-control/', link: '/interaction/comments', label: '互动播控' },
  { prefix: '/ai-center/', link: '/ai-center/assistant', label: 'AI能力中心' },
];

export default function Breadcrumb() {
  const { pathname } = useLocation();
  const matches = useMatches()
    .filter((match) => match.handle?.label)
    .map((match) => ({
      title: match.pathname === '/dashboard' ? <Link to="/dashboard">{match.handle.label}</Link> : match.handle.label,
    }));

  const moduleBreadcrumb = moduleBreadcrumbs.find((item) => pathname.startsWith(item.prefix));

  if (moduleBreadcrumb) {
    const currentLabel = matches[matches.length - 1]?.title || moduleBreadcrumb.label;
    return (
      <AntBreadcrumb
        items={[
          { title: '后台' },
          { title: <Link to={moduleBreadcrumb.link}>{moduleBreadcrumb.label}</Link> },
          { title: currentLabel },
        ]}
      />
    );
  }

  return <AntBreadcrumb items={matches} />;
}
