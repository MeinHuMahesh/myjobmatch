interface SkillDefinition {
  name: string;
  aliases: string[];
}

export const SKILL_DICTIONARY: SkillDefinition[] = [
  { name: "JavaScript", aliases: ["javascript", "java script", "js"] },
  { name: "TypeScript", aliases: ["typescript", "type script", "ts"] },
  { name: "Python", aliases: ["python", "python3"] },
  { name: "Java", aliases: ["java"] },
  { name: "C++", aliases: ["c++", "cpp"] },
  { name: "C#", aliases: ["c#", "csharp", "c sharp"] },
  { name: "Go", aliases: ["golang", "go lang"] },
  { name: "Rust", aliases: ["rust"] },
  { name: "Kotlin", aliases: ["kotlin"] },
  { name: "Swift", aliases: ["swift"] },
  { name: "Ruby", aliases: ["ruby"] },
  { name: "PHP", aliases: ["php"] },
  { name: "Scala", aliases: ["scala"] },
  { name: "MATLAB", aliases: ["matlab"] },
  { name: "SQL", aliases: ["sql"] },
  { name: "Bash", aliases: ["bash", "shell scripting", "shell script"] },
  { name: "Dart", aliases: ["dart"] },
  { name: "Julia", aliases: ["julia"] },
  { name: "Perl", aliases: ["perl"] },
  { name: "Haskell", aliases: ["haskell"] },
  { name: "Elixir", aliases: ["elixir"] },
  { name: "Lua", aliases: ["lua"] },
  { name: "React", aliases: ["react", "reactjs", "react.js"] },
  { name: "Next.js", aliases: ["next.js", "nextjs", "next js"] },
  { name: "Vue", aliases: ["vue", "vuejs", "vue.js"] },
  { name: "Angular", aliases: ["angular", "angularjs"] },
  { name: "Svelte", aliases: ["svelte", "sveltekit"] },
  { name: "HTML", aliases: ["html", "html5"] },
  { name: "CSS", aliases: ["css", "css3"] },
  { name: "Tailwind CSS", aliases: ["tailwind", "tailwindcss", "tailwind css"] },
  { name: "Sass", aliases: ["sass", "scss"] },
  { name: "Redux", aliases: ["redux", "redux toolkit"] },
  { name: "Webpack", aliases: ["webpack"] },
  { name: "Vite", aliases: ["vite"] },
  { name: "jQuery", aliases: ["jquery"] },
  { name: "Bootstrap", aliases: ["bootstrap"] },
  { name: "Material UI", aliases: ["material ui", "material-ui", "mui"] },
  { name: "React Native", aliases: ["react native"] },
  { name: "Node.js", aliases: ["node.js", "nodejs", "node js"] },
  { name: "Express", aliases: ["express", "expressjs", "express.js"] },
  { name: "NestJS", aliases: ["nestjs", "nest.js", "nest js"] },
  { name: "Django", aliases: ["django"] },
  { name: "Flask", aliases: ["flask"] },
  { name: "FastAPI", aliases: ["fastapi", "fast api"] },
  { name: "Spring Boot", aliases: ["spring boot", "spring", "springboot"] },
  { name: "Ruby on Rails", aliases: ["ruby on rails", "rails"] },
  { name: "Laravel", aliases: ["laravel"] },
  { name: ".NET", aliases: [".net", "dotnet", "asp.net", "asp net"] },
  { name: "GraphQL", aliases: ["graphql"] },
  { name: "REST APIs", aliases: ["rest", "rest api", "restful", "rest apis"] },
  { name: "gRPC", aliases: ["grpc"] },
  { name: "Microservices", aliases: ["microservices", "micro services"] },
  { name: "Kafka", aliases: ["kafka", "apache kafka"] },
  { name: "RabbitMQ", aliases: ["rabbitmq"] },
  { name: "Redis", aliases: ["redis"] },
  { name: "Machine Learning", aliases: ["machine learning", "ml"] },
  { name: "Deep Learning", aliases: ["deep learning", "dl"] },
  { name: "Data Science", aliases: ["data science"] },
  { name: "Data Analysis", aliases: ["data analysis", "data analytics"] },
  { name: "Pandas", aliases: ["pandas"] },
  { name: "NumPy", aliases: ["numpy"] },
  { name: "SciPy", aliases: ["scipy"] },
  { name: "scikit-learn", aliases: ["scikit-learn", "sklearn", "scikit learn"] },
  { name: "TensorFlow", aliases: ["tensorflow"] },
  { name: "PyTorch", aliases: ["pytorch", "torch"] },
  { name: "Keras", aliases: ["keras"] },
  { name: "OpenCV", aliases: ["opencv"] },
  { name: "NLP", aliases: ["nlp", "natural language processing"] },
  { name: "Computer Vision", aliases: ["computer vision", "cv"] },
  { name: "LLMs", aliases: ["llm", "llms", "large language model", "large language models"] },
  { name: "Transformers", aliases: ["transformers", "transformer models"] },
  { name: "Hugging Face", aliases: ["hugging face", "huggingface"] },
  { name: "Statistics", aliases: ["statistics", "statistical modeling"] },
  { name: "Data Visualization", aliases: ["data visualization", "data visualisation"] },
  { name: "Power BI", aliases: ["power bi", "powerbi"] },
  { name: "Tableau", aliases: ["tableau"] },
  { name: "Excel", aliases: ["excel", "ms excel", "advanced excel"] },
  { name: "Spark", aliases: ["spark", "apache spark", "pyspark"] },
  { name: "Hadoop", aliases: ["hadoop"] },
  { name: "Airflow", aliases: ["airflow", "apache airflow"] },
  { name: "ETL", aliases: ["etl", "elt"] },
  { name: "Big Data", aliases: ["big data"] },
  { name: "MySQL", aliases: ["mysql"] },
  { name: "PostgreSQL", aliases: ["postgresql", "postgres", "postgre sql"] },
  { name: "MongoDB", aliases: ["mongodb", "mongo db", "mongo"] },
  { name: "SQLite", aliases: ["sqlite"] },
  { name: "Oracle", aliases: ["oracle db", "oracle database"] },
  { name: "SQL Server", aliases: ["sql server", "mssql", "ms sql"] },
  { name: "DynamoDB", aliases: ["dynamodb"] },
  { name: "Cassandra", aliases: ["cassandra"] },
  { name: "Firebase", aliases: ["firebase", "firestore"] },
  { name: "Supabase", aliases: ["supabase"] },
  { name: "Elasticsearch", aliases: ["elasticsearch", "elastic search"] },
  { name: "Snowflake", aliases: ["snowflake"] },
  { name: "BigQuery", aliases: ["bigquery", "big query"] },
  { name: "AWS", aliases: ["aws", "amazon web services"] },
  { name: "Azure", aliases: ["azure", "microsoft azure"] },
  { name: "GCP", aliases: ["gcp", "google cloud", "google cloud platform"] },
  { name: "Docker", aliases: ["docker", "containerization", "containerisation"] },
  { name: "Kubernetes", aliases: ["kubernetes", "k8s"] },
  { name: "Terraform", aliases: ["terraform"] },
  { name: "Jenkins", aliases: ["jenkins"] },
  { name: "CI/CD", aliases: ["ci/cd", "cicd", "continuous integration"] },
  { name: "Git", aliases: ["git", "github", "gitlab", "version control"] },
  { name: "Linux", aliases: ["linux", "unix"] },
  { name: "Nginx", aliases: ["nginx"] },
  { name: "Ansible", aliases: ["ansible"] },
  { name: "Prometheus", aliases: ["prometheus"] },
  { name: "Grafana", aliases: ["grafana"] },
  { name: "Serverless", aliases: ["serverless", "lambda", "aws lambda"] },
  { name: "Android", aliases: ["android", "android development"] },
  { name: "iOS", aliases: ["ios", "ios development"] },
  { name: "Flutter", aliases: ["flutter"] },
  { name: "Blockchain", aliases: ["blockchain"] },
  { name: "Web3", aliases: ["web3"] },
  { name: "Solidity", aliases: ["solidity"] },
  { name: "Cybersecurity", aliases: ["cybersecurity", "cyber security", "information security"] },
  { name: "Penetration Testing", aliases: ["penetration testing", "pentest", "pen testing"] },
  { name: "Networking", aliases: ["networking", "computer networks"] },
  { name: "Embedded Systems", aliases: ["embedded systems", "embedded c"] },
  { name: "VLSI", aliases: ["vlsi"] },
  { name: "Verilog", aliases: ["verilog", "systemverilog", "system verilog"] },
  { name: "FPGA", aliases: ["fpga"] },
  { name: "AutoCAD", aliases: ["autocad"] },
  { name: "SolidWorks", aliases: ["solidworks", "solid works"] },
  { name: "CATIA", aliases: ["catia"] },
  { name: "ANSYS", aliases: ["ansys"] },
  { name: "CFD", aliases: ["cfd", "computational fluid dynamics"] },
  { name: "FEA", aliases: ["fea", "finite element analysis"] },
  { name: "IoT", aliases: ["iot", "internet of things"] },
  { name: "Robotics", aliases: ["robotics"] },
  { name: "ROS", aliases: ["ros", "robot operating system"] },
  { name: "Control Systems", aliases: ["control systems"] },
  { name: "Signal Processing", aliases: ["signal processing"] },
  { name: "Figma", aliases: ["figma"] },
  { name: "UI/UX", aliases: ["ui/ux", "ui ux", "user experience", "user interface"] },
  { name: "Product Management", aliases: ["product management", "product manager"] },
  { name: "Digital Marketing", aliases: ["digital marketing"] },
  { name: "SEO", aliases: ["seo", "search engine optimization"] },
  { name: "Data Structures", aliases: ["data structures"] },
  { name: "Algorithms", aliases: ["algorithms", "algorithm design"] },
  { name: "OOP", aliases: ["oop", "object oriented programming", "object-oriented programming"] },
  { name: "Operating Systems", aliases: ["operating systems"] },
  { name: "DBMS", aliases: ["dbms", "database management"] },
  { name: "System Design", aliases: ["system design", "distributed systems"] },
];

const aliasToCanonical = new Map<string, string>();
const aliasEntries: { alias: string; canonical: string; regex: RegExp }[] = [];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRegex(alias: string): RegExp {
  const escaped = escapeRegex(alias);
  const left = /^[a-z0-9]/i.test(alias) ? "(?<![a-z0-9])" : "";
  const right = /[a-z0-9]$/i.test(alias) ? "(?![a-z0-9])" : "";
  return new RegExp(`${left}${escaped}${right}`, "i");
}

for (const skill of SKILL_DICTIONARY) {
  for (const alias of [skill.name, ...skill.aliases]) {
    const key = alias.toLowerCase().trim();
    if (aliasToCanonical.has(key)) continue;
    aliasToCanonical.set(key, skill.name);
    aliasEntries.push({
      alias: key,
      canonical: skill.name,
      regex: buildRegex(key),
    });
  }
}

aliasEntries.sort((a, b) => b.alias.length - a.alias.length);

export function canonicalizeSkill(value: string): string {
  const key = value.toLowerCase().trim().replace(/[.)]+$/, "");
  return aliasToCanonical.get(key) ?? titleCase(key);
}

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .map((word) =>
      word.length <= 2 ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1),
    )
    .join(" ");
}

export function extractSkillsFromText(text: string): string[] {
  const found = new Set<string>();
  if (!text) return [];
  for (const entry of aliasEntries) {
    if (entry.regex.test(text)) found.add(entry.canonical);
  }
  return [...found].sort();
}

export function normalizeSkillList(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const canonical = canonicalizeSkill(trimmed);
    if (seen.has(canonical.toLowerCase())) continue;
    seen.add(canonical.toLowerCase());
    out.push(canonical);
  }
  return out;
}

export function findSkillsInLine(line: string): string[] {
  return extractSkillsFromText(line);
}
