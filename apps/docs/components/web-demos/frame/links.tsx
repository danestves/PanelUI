import { BellIcon, CreditCardIcon, KeyRoundIcon, UserRoundIcon } from 'lucide-react';
import { Frame } from 'panelui-web/frame';

const PAGES = [
  { title: 'Profile', description: 'Name, photo and time zone', Icon: UserRoundIcon },
  { title: 'Notifications', description: 'Email and push', Icon: BellIcon },
  { title: 'Security', description: 'Passkeys and sessions', Icon: KeyRoundIcon },
  { title: 'Billing', description: 'Plan and invoices', Icon: CreditCardIcon },
];

export default function FrameLinks() {
  return (
    <Frame className="w-full max-w-sm">
      <Frame.Header>
        <Frame.Title>Account</Frame.Title>
      </Frame.Header>
      <Frame.Panel>
        {PAGES.map(({ title, description, Icon }) => (
          <Frame.Row key={title} href="#" chevron>
            <Frame.Media className="text-muted-foreground">
              <Icon className="size-4" />
            </Frame.Media>
            <Frame.Content>
              <Frame.Title as="p">{title}</Frame.Title>
              <Frame.Description>{description}</Frame.Description>
            </Frame.Content>
          </Frame.Row>
        ))}
      </Frame.Panel>
    </Frame>
  );
}
