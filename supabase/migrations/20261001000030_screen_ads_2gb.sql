-- Raise screen-ads storage limit so artist LED logos/loops can be up to 2 GB.
update storage.buckets
set file_size_limit = 2147483648
where id = 'screen-ads';
