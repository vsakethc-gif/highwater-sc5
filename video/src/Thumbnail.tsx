/**
 * Thumbnail.tsx — the Challenge thumbnail (600 x 800, JPEG): only the app's own icon, centered on one flat color.
 */
import { AbsoluteFill, Img, staticFile } from 'remotion';

export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ background: '#F3EFE7', alignItems: 'center', justifyContent: 'center' }}>
    <Img src={staticFile('logo.png')} style={{ width: 400, height: 400, borderRadius: 90 }} />
  </AbsoluteFill>
);
