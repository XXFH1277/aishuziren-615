import { Breadcrumb as AntBreadcrumb } from 'antd';
import { Link, useMatches } from 'react-router-dom';

export default function Breadcrumb() {
  const matches = useMatches()
    .filter((match) => match.handle?.label)
    .map((match) => ({
      title: match.pathname === '/dashboard' ? (
        <Link to="/dashboard">{match.handle.label}</Link>
      ) : (
        match.handle.label
      ),
    }));

  return <AntBreadcrumb items={matches} />;
}
