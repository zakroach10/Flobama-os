-- Screens → LED wall MP4 loops and PNG stills use the same 2 GB screen-ads limit as artist graphics.
update storage.buckets
set file_size_limit = 2147483648
where id = 'screen-ads';
