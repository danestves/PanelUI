import { Frame } from 'panelui-web/frame';

export default function FrameThumb() {
  return (
    <div className="w-72 shrink-0 scale-[0.7]">
      <Frame>
        <Frame.Header>
          <Frame.Title>Deploys</Frame.Title>
          <Frame.Action>24h</Frame.Action>
        </Frame.Header>
        <Frame.Panel>
          {['main · a41c2e9', 'feature/sheet', 'docs/hero'].map((ref) => (
            <Frame.Row key={ref}>
              <Frame.Content>
                <Frame.Title as="p">{ref}</Frame.Title>
                <Frame.Description>Production</Frame.Description>
              </Frame.Content>
            </Frame.Row>
          ))}
        </Frame.Panel>
      </Frame>
    </div>
  );
}
