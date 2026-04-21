export type Slot = {
  id: string;
  day: number;
  period: number;
  subject: {
    name: string;
  };
  teacher: {
    user: {
      username: string;
    };
  };
};
