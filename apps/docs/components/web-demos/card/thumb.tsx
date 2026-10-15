import { Card } from 'panelui-web/card';

export default function CardThumb() {
  return (
    <div className="w-72 shrink-0 scale-[0.7]">
      <Card>
        <Card.Header>
          <Card.Title>Storage</Card.Title>
          <Card.Description>184 GB of 250 GB</Card.Description>
        </Card.Header>
        <Card.Content>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-3/4 rounded-full bg-primary" />
          </div>
        </Card.Content>
        <Card.Footer variant="panel" className="justify-end">
          <span className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
            Upgrade
          </span>
        </Card.Footer>
      </Card>
    </div>
  );
}
