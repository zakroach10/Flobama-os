-- Raise the shared screen-ads bucket above the original 50 MB cap.
-- LED wall loops and vertical ads both upload into this bucket.

update storage.buckets
set file_size_limit = 2147483648
where id = 'screen-ads';
