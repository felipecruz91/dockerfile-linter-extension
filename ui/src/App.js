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
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
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
  { field: "id", headerName: "ID", width: 60, hide: true },
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
  const [dockerfileContent, setDockerfileContent] = React.useState(undefined);
  const [dockerfileSavedOnVolume, setDockerfileSavedOnVolume] =
    React.useState(false);
  const [dockerfileOpened, setDockerfileOpened] = React.useState(false);
  const [linting, setLinting] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [hints, setHints] = React.useState([]);
  const [mode, setMode] = useState("light");
  const ddClient = useDockerDesktopClient();

  useEffect(() => {
    ddClient.docker.cli.exec("volume", ["create", "my-vol"]).then((output) => {
      console.log(output);
    });
  }, []);

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
    // if (!dockerfileSavedOnVolume) {
    //   console.warn("dockerfileSavedOnVolume:", dockerfileSavedOnVolume);
    //   setLinting(false);
    //   return;
    // }

    setLinting(true);

    ddClient.docker.cli
      .exec("run", [
        "--rm",
        "-i",
        "-v",
        "my-vol:/tmp",
        "hadolint/hadolint",
        "hadolint",
        "-f",
        "json",
        "/tmp/Dockerfile",
      ])
      .then(() => {
        ddClient.desktopUI.toast.success("🎉 All good!");
        setHints([]);
        setLinting(false);
      })
      .catch((result) => {
        console.log("result", result);
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
          setDirty(false);
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

        // Read Dockerfile content from file on disk
        console.log("Reading Dockerfile content from file on disk...");
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
          .then((result) => {
            console.log(result.stdout);
            setDockerfileContent(result.stdout);
            setDockerfileOpened(!dockerfileOpened);

            console.log(
              "Dockerfile content loaded on memory. Saving it to a volume..."
            );
            ddClient.docker.cli
              .exec("run", [
                "--rm",
                "-v",
                "my-vol:/tmp",
                "alpine",
                "/bin/sh",
                "-c",
                `"touch /tmp/Dockerfile && echo '${result.stdout}' > /tmp/Dockerfile && cat /tmp/Dockerfile"`,
              ])
              .then((result) => {
                console.log(result);
                // setDockerfileSavedOnVolume(!dockerfileSavedOnVolume);
                setDockerfileSavedOnVolume(!dockerfileSavedOnVolume);
              })
              .catch((error) => {
                console.error(error);
                ddClient.desktopUI.toast.error(error);
              });
          })
          .catch((error) => {
            ddClient.desktopUI.toast.error(error);
          });
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
    console.log("useEffect");
    if (dockerfileContent !== undefined) {
      console.log("dockerfileContent", dockerfileContent);
      console.log("linting by useEffect...");
      lint();
    }
  }, [dockerfileOpened, dockerfileSavedOnVolume]);

  const reload = () => {
    console.log("reloading...");
    setLinting(true);
    // write Dockerfile to volume
    console.log("updating Dockerfile with content:", dockerfileContent);
    ddClient.docker.cli
      .exec("run", [
        "--rm",
        "-v",
        "my-vol:/tmp",
        "alpine",
        "/bin/sh",
        "-c",
        `"touch /tmp/Dockerfile && echo '${dockerfileContent}' > /tmp/Dockerfile && cat /tmp/Dockerfile"`,
      ])
      .then((result) => {
        console.log(result);
        // setDockerfileModifiedOnDisk(!dockerfileModifiedOnDisk);
        setDockerfileSavedOnVolume(!dockerfileSavedOnVolume);
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

        <Grid container spacing={2}>
          <Grid item>
            <Button variant="contained" onClick={openDockerfile}>
              Select Dockerfile
            </Button>
          </Grid>
          <Grid item>
            <Button variant="contained" disabled={linting} onClick={reload}>
              Lint
            </Button>
          </Grid>
        </Grid>

        <Grid container spacing={2} mt={"8px"} mb={"8px"}>
          <Grid item xs={6}>
            <TextField
              id="outlined-multiline-flexible"
              placeholder="FROM ubuntu:latest"
              spellCheck="false"
              multiline
              minRows={10}
              value={dockerfileContent}
              onChange={(e) => {
                setDirty(true);
                setDockerfileContent(e.target.value);
              }}
              fullWidth
            />
          </Grid>
          <Grid item xs={6}>
            {dockerfileContent && (
              <>
                {linting ? (
                  <Skeleton
                    variant="rectangular"
                    width={"100%"}
                    height={"100%"}
                  />
                ) : (
                  <>
                    <CopyToClipboardButton
                      dockerfileContent={dockerfileContent}
                    />
                    <SyntaxHighlighter
                      language="Dockerfile"
                      style={mode === "light" ? vs : vs2015}
                      showLineNumbers
                      startingLineNumber={1}
                      wrapLines
                      wrapLongLines
                      customStyle={{
                        textAlign: "left",
                        overflowX: "clip",
                      }}
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
                        if (dirty) {
                          color = "grey";
                        }

                        if (special) {
                          return {
                            style: {
                              display: "block",
                              cursor: "pointer",
                              borderColor: color,
                              borderLeftStyle: "solid",
                              borderWidth: "thick",
                              flexWrap: "wrap",
                            },
                            onClick() {
                              let msg = "";
                              const msgs =
                                getHintMessagesByLineNumber(lineNumber);
                              msgs.forEach((element) => {
                                msg = msg + "\n" + element + "\n";
                              });

                              alert(
                                `Line ${lineNumber} - (${lhint.level})\n\n${msg}`
                              );
                            },
                          };
                        } else {
                          return {
                            style: {
                              paddingLeft: "5px",
                              flexWrap: "wrap",
                            },
                          };
                        }
                      }}
                    >
                      {dockerfileContent}
                    </SyntaxHighlighter>
                  </>
                )}
              </>
            )}
          </Grid>
        </Grid>

        <div style={{ height: 400, width: "100%" }}>
          {hints.length > 0 && (
            <DataGrid
              rows={hints}
              columns={columns}
              pageSize={5}
              rowsPerPageOptions={[5]}
              checkboxSelection
              loading={linting}
            />
          )}
        </div>
      </div>
    </DockerMuiThemeProvider>
  );
}

export default App;
