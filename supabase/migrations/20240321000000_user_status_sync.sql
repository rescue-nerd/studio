-- Create a function to handle user status changes
CREATE OR REPLACE FUNCTION handle_user_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If the status has changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Update the auth.users table
    UPDATE auth.users
    SET disabled = (NEW.status = 'disabled')
    WHERE id = NEW.uid;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the function
DROP TRIGGER IF EXISTS on_user_status_change ON public.users;
CREATE TRIGGER on_user_status_change
  AFTER UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_status_change(); 