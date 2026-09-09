-- Add divider and restroom markers to the FloBama room palette.

alter type public.layout_object_type add value if not exists 'divider';
alter type public.layout_object_type add value if not exists 'restroom';

notify pgrst, 'reload schema';
