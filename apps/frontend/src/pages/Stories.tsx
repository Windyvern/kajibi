import { useSearchParams } from 'react-router-dom';
import MapView from './MapView';
import Gallery from './Gallery';

export default function Stories() {
  const [params] = useSearchParams();
  const isMap = params.get('style') === 'map';
  return isMap ? <MapView /> : <Gallery />;
}
