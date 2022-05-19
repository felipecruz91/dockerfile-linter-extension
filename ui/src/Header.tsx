import React from "react";
import { Box, Grid, Typography } from "@mui/material";

const Header = () => {
  return (
    <Grid
      container
      margin={(theme) => theme.spacing(2, 0)}
      alignItems="center"
      justifyContent={"space-between"}
    >
      <Grid item sm={8}>
        <Box display="flex" alignItems="center">
          <Typography
            variant="body1"
            sx={{
              fontSize: "20px",
              whiteSpace: "nowrap",
              fontWeight: (theme) => theme.typography.fontWeightBold,
            }}
          >
            Dockerfile Linter
          </Typography>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ marginTop: (theme) => theme.spacing(1) }}
        >
          Lint your Dockerfile.
        </Typography>
      </Grid>
    </Grid>
  );
};

export default Header;
