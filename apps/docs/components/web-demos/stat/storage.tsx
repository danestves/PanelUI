import { Frame } from 'panelui-web/frame';
import { RangeMeter } from 'panelui-web/range-meter';
import { Stat } from 'panelui-web/stat';

export default function StatStorage() {
  return (
    <Frame variant="band" className="w-full max-w-sm">
      <Frame.Header>
        <Frame.Title>Storage</Frame.Title>
        <Frame.Action>Design team</Frame.Action>
      </Frame.Header>

      <Frame.Panel className="gap-4 p-5">
        <Stat>
          <Stat.Content>
            <Stat.Label>Used</Stat.Label>
            <Stat.Value>
              68.4
              <Stat.Unit>GB</Stat.Unit>
            </Stat.Value>
          </Stat.Content>
          <Stat.Badge>31.6 GB free</Stat.Badge>
        </Stat>

        <div className="flex flex-col gap-2">
          <RangeMeter
            value={68}
            color="info"
            formatValue={(value) => `${value}%`}
            label="Storage used"
            valueText="68 percent used"
          />
          <RangeMeter.Scale start="0 GB" end="100 GB" />
        </div>
      </Frame.Panel>
    </Frame>
  );
}
