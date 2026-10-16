import type { Key } from 'react-aria-components'
import {
  Button,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
} from 'react-aria-components'

export type SelectOption<Id extends Key> = { id: Id; label: string }

// A choice from a short list. `name` submits the chosen option's id with the
// form
export const SelectField = <Id extends Key>({
  label,
  name,
  options,
  value,
  onChange,
}: {
  label: string
  name: string
  options: SelectOption<Id>[]
  value: Id
  onChange: (value: Id) => void
}) => (
  <Select
    name={name}
    value={value}
    onChange={key => {
      if (key !== null) {
        onChange(key as Id)
      }
    }}
    className='flex flex-col gap-1'
  >
    <Label className='font-semibold'>{label}</Label>
    <Button className='flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-2 border-2 border-ink bg-white px-3 text-start outline-offset-2 data-focus-visible:outline-3 data-focus-visible:outline-accent-strong'>
      <SelectValue className='min-w-0 flex-1 truncate' />
      <span aria-hidden>▾</span>
    </Button>
    <Popover className='max-h-80 w-(--trigger-width) overflow-auto border-2 border-ink bg-white'>
      <ListBox items={options} className='outline-none'>
        {option => (
          <ListBoxItem
            id={option.id}
            textValue={option.label}
            className='cursor-pointer px-3 py-2 outline-none data-focused:bg-accent-soft/40 data-selected:font-semibold'
          >
            {option.label}
          </ListBoxItem>
        )}
      </ListBox>
    </Popover>
  </Select>
)
