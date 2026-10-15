import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Card } from 'panelui-web/card';

export default function CardForm() {
  return (
    <Card as="section" className="w-full max-w-sm">
      <Card.Header>
        <Card.Title>Create a workspace</Card.Title>
        <Card.Description>Start on the free plan and invite your team later.</Card.Description>
        <Card.Action>
          <Button variant="link" className="px-0">
            Sign in
          </Button>
        </Card.Action>
      </Card.Header>
      <Card.Content>
        <form id="create-workspace" className="flex flex-col gap-5">
          <Field>
            <FieldLabel>Work email</FieldLabel>
            <Input type="email" placeholder="you@company.com" required />
          </Field>
          <Field>
            <FieldLabel>Workspace name</FieldLabel>
            <Input placeholder="Northwind Studio" required />
            <FieldDescription>You can change it at any time.</FieldDescription>
          </Field>
        </form>
      </Card.Content>
      <Card.Footer variant="panel" className="flex-col gap-2">
        <Button type="submit" form="create-workspace" className="w-full">
          Create workspace
        </Button>
        <Button variant="outline" className="w-full">
          Continue with Google
        </Button>
      </Card.Footer>
    </Card>
  );
}
