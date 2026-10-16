import { Card } from 'panelui-web/card';
import { Stat } from 'panelui-web/stat';

export default function StatThumb() {
  return (
    <Card className="w-72 shrink-0">
      <Card.Content>
        <Stat>
          <Stat.Content>
            <Stat.Label>Response time</Stat.Label>
            <Stat.Value>
              240
              <Stat.Unit>ms</Stat.Unit>
            </Stat.Value>
          </Stat.Content>
          <Stat.Badge>Inside budget</Stat.Badge>
        </Stat>
      </Card.Content>
    </Card>
  );
}
