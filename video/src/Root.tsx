import { Composition } from 'remotion';
import { FPS, TOTAL_SECONDS } from './edit';
import { HighWater } from './HighWater';
import { Thumbnail } from './Thumbnail';
import { fontsReady } from './theme';

// Wait for the app's fonts before any frame is drawn.
void fontsReady;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="HighWater" component={HighWater} durationInFrames={Math.round(TOTAL_SECONDS * FPS)} fps={FPS} width={1920} height={1080} defaultProps={{ name: 'Saketh' }} />
      <Composition id="Thumbnail" component={Thumbnail} durationInFrames={1} fps={FPS} width={600} height={800} />
    </>
  );
};
