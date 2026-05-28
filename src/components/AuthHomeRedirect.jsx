import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getFirstAccessiblePath } from '../mock/menu';

export default function AuthHomeRedirect() {
  const { menuPermissions } = useAuth();
  return <Navigate to={getFirstAccessiblePath(menuPermissions)} replace />;
}
