import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Frame } from 'panelui-web/frame';

const DAYS = [
  {
    day: 'Today',
    events: [
      { who: 'IF', text: 'Ife commented on Checkout redesign', when: '10:42' },
      { who: 'TM', text: 'Tomás moved Search ranking to Blocked', when: '09:15' },
    ],
  },
  {
    day: 'Yesterday',
    events: [
      { who: 'HK', text: 'Hana shipped Onboarding emails', when: '17:30' },
      { who: 'NH', text: 'Noor invited Pavel to Payments', when: '11:02' },
    ],
  },
];

export default function FrameSections() {
  return (
    <Frame className="w-full max-w-md">
      <Frame.Header>
        <Frame.Title>Activity</Frame.Title>
        <Frame.Action>All projects</Frame.Action>
      </Frame.Header>
      <Frame.Panel>
        {DAYS.map(({ day, events }) => (
          <Frame.Section key={day} title={day}>
            {events.map((event) => (
              <Frame.Row key={event.text}>
                <Frame.Media>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">{event.who}</AvatarFallback>
                  </Avatar>
                </Frame.Media>
                <Frame.Content>
                  <Frame.Title as="p">{event.text}</Frame.Title>
                </Frame.Content>
                <Frame.Actions className="text-sm text-muted-foreground tabular-nums">{event.when}</Frame.Actions>
              </Frame.Row>
            ))}
          </Frame.Section>
        ))}
      </Frame.Panel>
    </Frame>
  );
}
