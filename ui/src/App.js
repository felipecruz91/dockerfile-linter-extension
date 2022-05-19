import React, { useEffect } from "react";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import { DataGrid } from "@mui/x-data-grid";
import { DockerMuiThemeProvider } from "@docker/docker-mui-theme";
import { createDockerDesktopClient } from "@docker/extension-api-client";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";
import "./App.css";
import Header from "./Header.tsx";

const client = createDockerDesktopClient();

function useDockerDesktopClient() {
  return client;
}

const columns = [
  { field: "id", headerName: "ID", width: 70 },
  { field: "line", headerName: "Line", width: 130 },
  { field: "code", headerName: "Code", width: 130 },
  { field: "level", headerName: "Level", width: 130 },
  { field: "message", headerName: "Message", width: 630 },
];

function App() {
  const [dockerfilePath, setDockerfilePath] = React.useState("");
  const [dockerfileContent, setDockerfileContent] = React.useState(undefined);
  const [hints, setHints] = React.useState([]);
  const ddClient = useDockerDesktopClient();

  const lint = () => {
    ddClient.docker.cli
      .exec("run", [
        "--rm",
        "-i",
        "hadolint/hadolint",
        "hadolint",
        "-f",
        "json",
        "-",
        "<",
        dockerfilePath,
      ])
      .then(() => {
        ddClient.desktopUI.toast.success("🎉 All good!");
      })
      .catch((result) => {
        if (result.stdout !== "") {
          const jsonOutput = JSON.parse(result.stdout);

          const hs = jsonOutput.map((j, index) => {
            return {
              id: index,
              line: j.line,
              code: j.code,
              level: j.level,
              message: j.message,
            };
          });

          setHints(hs);
        }
      });
  };

  const openDockerfile = () => {
    setHints([]);

    ddClient.desktopUI.dialog
      .showOpenDialog({ properties: ["openFile"] })
      .then((result) => {
        if (result.canceled) {
          return;
        }
        setDockerfilePath(result.filePaths[0]);

        ddClient.docker.cli
          .exec("run", [
            "--rm",
            "-v",
            `${result.filePaths[0]}:/Dockerfile`,
            "alpine",
            "/bin/sh",
            "-c",
            '"cat Dockerfile"',
          ])
          .then((catOutput) => {
            setDockerfileContent(catOutput.stdout);
          });
      })
      .catch((err) => {
        ddClient.desktopUI.toast.error(err);
      });
  };

  useEffect(() => {
    if (dockerfileContent !== undefined || dockerfileContent !== "") {
      lint();
    }
  }, [dockerfileContent]);

  return (
    <DockerMuiThemeProvider>
      <CssBaseline />
      <div className="">
        <Header />

        <Button variant="contained" onClick={openDockerfile}>
          Select Dockerfile
        </Button>
        {dockerfileContent && (
          <SyntaxHighlighter
            language="Dockerfile"
            style={docco}
            showLineNumbers
            startingLineNumber={1}
            wrapLines
            customStyle={{ textAlign: "left" }}
          >
            {dockerfileContent}
          </SyntaxHighlighter>
        )}
        <div style={{ height: 400, width: "100%" }}>
          {hints.length > 0 && (
            <DataGrid
              rows={hints}
              columns={columns}
              pageSize={5}
              rowsPerPageOptions={[5]}
              checkboxSelection
            />
          )}
        </div>
      </div>
    </DockerMuiThemeProvider>
  );
}

export default App;
