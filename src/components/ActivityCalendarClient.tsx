import { ActivityCalendar, type ThemeInput } from "react-activity-calendar";

export type Activity = {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
};

interface ActivityCalendarClientProps {
  data: Activity[];
}

const gitHubTheme = {
  dark: ["#151b23", "#033a16", "#196c2e", "#2ea043", "#56d364"],
} satisfies ThemeInput;

const defaultLabels = {
  totalCount: "{{count}} contributions this year so far",
};

const fontFaceStyle = `
  @font-face {
    font-family: "Hurmit";
    src: url("/src/assets/fonts/HurmitNerdFont-Regular.otf") format("opentype");
  }
    #githubContrib {
      margin-top: 5rem;
      background-color: rgba(30, 40, 30, 0.72);
      font-family: "Hurmit", sans-serif;
      padding: 1rem;
      border-radius: 0.5rem;
      color: rgba(135, 210, 135, 0.52);
      border : 1px solid rgba(135, 210, 135, 0.22);
      box-shadow: 0 0px 6px rgba(39, 106, 3, 0.93);


    }
      a {
        color: rgba(135, 210, 135, 0.72);
      }   
    @media screen and (max-width: 900px) {
      #githubContrib {
        container-type: inline-size; 
        width: 100%;    
        margin-bottom: 2rem;
      }     
    }
`;

export default function ActivityCalendarClient({
  data,
}: ActivityCalendarClientProps) {
  return (
    <>
      <style>{fontFaceStyle}</style>
      <div id="githubContrib" className="flex flex-col gap-8">
        <ActivityCalendar
          data={data}
          theme={gitHubTheme}
          maxLevel={4}
          labels={defaultLabels}
          colorScheme="dark"
        />

        <div className="flex justify-end">
          <a
            href="https://github.com/robinrj6"
            className="flex items-center gap-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            @robinrj6
          </a>
        </div>
      </div>
    </>
  );
}
