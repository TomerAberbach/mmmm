// Tests can't change the server's environment once it starts, so each test
// that needs an admin takes its own address from this list
export const ADMIN_LIST = Array.from(
  { length: 8 },
  (_, index) => `admin-${index}@example.com`,
)
