import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const Grid = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
`;

const CardLink = styled(Link)`
  display: block;
  padding: 1.25rem 1.4rem;
  color: inherit;
  text-decoration: none;

  &:hover {
    text-decoration: none;
    color: inherit;
    background: var(--color-card-bg-hover);
  }

  h2 {
    margin: 0 0 0.5rem;
  }

  p {
    margin: 0;
    color: var(--color-text-secondary);
  }
`;

export const HomePage = () => (
  <div className="container">
    <div className="card mb-4">
      <div className="card-body">
        <h1 className="mb-2">Exercise Games</h1>
        <p className="mb-0" style={{ color: "var(--color-text-secondary)" }}>
          Use a camera and your body to fly, play, and check that pose tracking is working.
        </p>
      </div>
    </div>

    <Grid>
      <CardLink className="card" to="/fly">
        <h2>Gyrocopter flight</h2>
        <p>
          Flap your arms for throttle and tilt your body or neck to turn. Chase-cam over Meadow
          Airport.
        </p>
      </CardLink>
      <CardLink className="card" to="/diagnostics">
        <h2>Pose diagnostics</h2>
        <p>
          Live stick-figure overlay and head/arm angle readouts for tuning the camera controls.
        </p>
      </CardLink>
    </Grid>
  </div>
);
