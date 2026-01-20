export type Opportunity = {
  id: string;
  title: string;
  dept: string;
  lab: string;
  type: "Paid" | "Volunteer" | "Course credit";
  hoursPerWeek: number;
  location: "UBC Vancouver" | "Hybrid" | "Remote";
  tags: string[];
  description: string;
  applyUrl?: string;
  email?: string;
};

export const opportunities: Opportunity[] = [
  {
    id: "1",
    title: "Undergrad Research Assistant, Neuroimaging Lab",
    dept: "Neuroscience",
    lab: "Example Lab",
    type: "Volunteer",
    hoursPerWeek: 8,
    location: "UBC Vancouver",
    tags: ["MRI", "Python", "Data cleaning"],
    description:
      "Help with participant scheduling, basic data QC, and simple analysis scripts. Training provided.",
    email: "lab@example.com",
  },
  {
    id: "2",
    title: "Data analysis assistant (R/Python), Population Health",
    dept: "SPPH",
    lab: "Example Group",
    type: "Paid",
    hoursPerWeek: 5,
    location: "Hybrid",
    tags: ["R", "Stats", "Literature"],
    description:
      "Support dataset cleaning and summary tables for a health outcomes project. Prior R helpful.",
    applyUrl: "https://example.com/apply",
  },
  {
    id: "3",
    title: "Wet lab assistant, Immunology",
    dept: "Microbiology & Immunology",
    lab: "Example Immunology Lab",
    type: "Course credit",
    hoursPerWeek: 10,
    location: "UBC Vancouver",
    tags: ["Pipetting", "Cell culture", "Lab safety"],
    description:
      "Assist with routine cell culture and sample prep. Must be reliable and able to commit for a term.",
    email: "pi@example.com",
  },
];
