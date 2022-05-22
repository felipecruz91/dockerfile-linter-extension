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
import TextareaAutosize from "@mui/material/TextareaAutosize";
import "./App.css";
import Header from "./Header.tsx";
import CopyToClipboardButton from "./CopyToClipboardButton";

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
  const [dockerfileModifiedOnDisk, setDockerfileModifiedOnDisk] =
    React.useState(false);
  const [dockerfileOpened, setDockerfileOpened] = React.useState(false);
  const [linting, setLinting] = React.useState(false);
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
    setLinting(true);

    if (dockerfilePath == undefined || dockerfilePath == "") {
      console.warn("dockerfilePath not set:", dockerfilePath);
      setLinting(false);
      return;
    }

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
        setHints([]);
        setLinting(false);
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
          setLinting(false);
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
            setDockerfileOpened(!dockerfileOpened);
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

  // useEffect(() => {
  //   if (dockerfileContent !== undefined || dockerfileContent !== "") {
  //     console.log("linting by useEffect...");
  //     lint();
  //   }
  // }, [dockerfileContent, dockerfileModifiedOnDisk]);

  useEffect(() => {
    console.log("useEffect");
    if (dockerfileContent !== undefined || dockerfileContent !== "") {
      console.log("linting by useEffect...");
      lint();
    }
  }, [dockerfileOpened, dockerfileModifiedOnDisk]);

  const reload = () => {
    console.log("reloading...");
    setLinting(true);
    // write file to disk
    // docker run --name create-dockerfile alpine /bin/sh -c "touch ./Dockerfile && echo 'FROM ubuntu:latest' >> Dockerfile && cat Dockerfile"
    ddClient.docker.cli
      .exec("run", [
        "--name",
        "create-dockerfile",
        "alpine",
        "/bin/sh",
        "-c",
        `"touch ./Dockerfile && echo '${dockerfileContent}' >> Dockerfile && cat Dockerfile"`,
      ])
      .then((result) => {
        console.log(result);
        // docker cp create-dockerfile:/Dockerfile /tmp/Dockerfile
        const tmpPath = "/tmp/Dockerfile";
        ddClient.docker.cli
          .exec("cp", ["create-dockerfile:/Dockerfile", tmpPath])
          .then((result) => {
            console.log(result);
            // docker rm create-dockerfile
            ddClient.docker.cli
              .exec("rm", ["create-dockerfile"])
              .then((result) => {
                console.log(result);
                console.log("tmp path:", tmpPath);
                setDockerfilePath(tmpPath);
                setDockerfileModifiedOnDisk(!dockerfileModifiedOnDisk);
              })
              .catch((error) => {
                console.error(error);
              });
          })
          .catch((error) => {
            console.error(error);
          });
      })
      .catch((error) => {
        console.error(error);
      });
  };
  return (
    <DockerMuiThemeProvider>
      <CssBaseline />
      <div className="">
        <Header />

        <Button variant="contained" onClick={openDockerfile}>
          Select Dockerfile
        </Button>
        <TextareaAutosize
          aria-label="empty textarea"
          placeholder="FROM ubuntu:latest"
          minRows={10}
          maxRows={20}
          value={dockerfileContent}
          onChange={(e) => {
            setDockerfileContent(e.target.value);
          }}
          // defaultValue="FROM ubuntu:latest"
          style={{ width: 200 }}
        />
        <Button variant="contained" disabled={linting} onClick={reload}>
          Lint
        </Button>
        {dockerfileContent && (
          <>
            <CopyToClipboardButton dockerfileContent={dockerfileContent} />

            <SyntaxHighlighter
              language="Dockerfile"
              style={mode == "light" ? vs : vs2015}
              showLineNumbers
              startingLineNumber={1}
              wrapLines
              customStyle={{ textAlign: "left", overflowX: "clip" }}
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
          </>
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
