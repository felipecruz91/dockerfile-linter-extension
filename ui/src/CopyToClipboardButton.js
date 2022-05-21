import { useState } from "react";
import { IconButton, Snackbar } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

const CopyToClipboardButton = (dockerfileContent) => {
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    setOpen(true);
    console.log(dockerfileContent.dockerfileContent);
    navigator.clipboard.writeText(dockerfileContent.dockerfileContent);
  };

  return (
    <>
      <IconButton
        onClick={handleClick}
        color="primary"
        style={{ float: "right", marginTop: "50px" }}
      >
        <ContentCopyIcon />
      </IconButton>
      <Snackbar
        message="Copied to clibboard"
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        autoHideDuration={2000}
        onClose={() => setOpen(false)}
        open={open}
      />
    </>
  );
};

export default CopyToClipboardButton;
