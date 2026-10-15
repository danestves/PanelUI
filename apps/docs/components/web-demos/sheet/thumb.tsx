'use client';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Sheet } from 'panelui-web/sheet';

export default function SheetThumb() {
  return (
    <div className="w-80 shrink-0 scale-[0.62]">
      <Sheet>
        <Sheet.Content inline>
          <Sheet.Header title="Edit profile" description="Shown on your public page." />
          <Sheet.Body>
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input defaultValue="Noor Haddad" tabIndex={-1} />
            </Field>
          </Sheet.Body>
          <Sheet.Footer>
            <Button size="lg" tabIndex={-1}>
              Save changes
            </Button>
          </Sheet.Footer>
        </Sheet.Content>
      </Sheet>
    </div>
  );
}
