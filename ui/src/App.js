import React, { useEffect, useState } from "react";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import { DataGrid } from "@mui/x-data-grid";
import Chip from "@mui/material/Chip";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import FormatColorFillIcon from "@mui/icons-material/FormatColorFill";
import { DockerMuiThemeProvider } from "@docker/docker-mui-theme";
import { createDockerDesktopClient } from "@docker/extension-api-client";
import SyntaxHighlighter from "react-syntax-highlighter";
import { vs, vs2015 } from "react-syntax-highlighter/dist/esm/styles/hljs";
import "./App.css";
import Header from "./Header.tsx";

const client = createDockerDesktopClient();

function useDockerDesktopClient() {
  return client;
}

const levelColors = {
  error: "red",
  warning: "orange",
  info: "blue",
  style: "grey",
};

const levelIcons = {
  error: <ErrorIcon />,
  warning: <WarningIcon />,
  info: <InfoIcon />,
  style: <FormatColorFillIcon />,
};

const levelChipColorAttr = {
  error: "error",
  warning: "warning",
  info: "info",
  style: "default",
};

const columns = [
  { field: "id", headerName: "ID", width: 60 },
  { field: "line", headerName: "Line", width: 60 },
  { field: "code", headerName: "Code", width: 130 },
  {
    field: "level",
    headerName: "Level",
    width: 130,
    renderCell: (params) => (
      <Chip
        icon={levelIcons[params.row.level]}
        label={params.row.level}
        color={levelChipColorAttr[params.row.level]}
        variant="outlined"
      />
    ),
  },
  { field: "message", headerName: "Message", width: 630 },
];

function App() {
  const [dockerfilePath, setDockerfilePath] = React.useState("");
  const [dockerfileContent, setDockerfileContent] = React.useState(undefined);
  const [hints, setHints] = React.useState([]);
  const [mode, setMode] = useState("light");
  const ddClient = useDockerDesktopClient();

  useEffect(() => {
    // Add listener to update styles
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", (e) => {
        setMode(e.matches ? "dark" : "light");
      });

    // Setup dark/light mode for the first time
    setMode(
      window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
    );

    // Remove listener
    return () => {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .removeEventListener("change", () => {});
    };
  }, []);

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

  const getHintMessagesByLineNumber = (lineNumber) => {
    let msgs = [];
    for (let index = 0; index < hints.length; index++) {
      const hint = hints[index];
      if (lineNumber === hint.line) {
        msgs.push(hint.message);
      }
    }
    return msgs;
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
            style={mode == "light" ? vs : vs2015}
            showLineNumbers
            startingLineNumber={1}
            wrapLines
            customStyle={{ textAlign: "left" }}
            lineProps={(lineNumber) => {
              let special = false;
              let lhint = undefined;
              for (let index = 0; index < hints.length; index++) {
                const hint = hints[index];
                if (lineNumber === hint.line) {
                  lhint = hint;
                  special = true;
                  break;
                }
              }
              let color = undefined;
              if (lhint !== undefined) {
                color = levelColors[lhint.level];
              }

              if (special) {
                return {
                  style: {
                    display: "block",
                    cursor: "pointer",
                    // color: color ?? "none",
                    borderLeft: color,
                    borderLeftStyle: "solid",
                    borderWidth: "thick",
                  },
                  onClick() {
                    let msg = "";
                    const msgs = getHintMessagesByLineNumber(lineNumber);
                    msgs.forEach((element) => {
                      msg = msg + "\n" + element + "\n";
                    });

                    alert(`Line ${lineNumber} - (${lhint.level})\n\n${msg}`);
                  },
                };
              } else {
                return { style: { paddingLeft: "5px" } };
              }
            }}
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
