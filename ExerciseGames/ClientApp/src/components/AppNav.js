import React from "react";
import { Link } from "react-router-dom";
import styled from "styled-components";

const Bar = styled.nav`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.25rem;
  align-items: center;
  margin-bottom: 1rem;
`;

export const AppNav = ({ current }) => (
  <Bar>
    <Link to="/">Home</Link>
    {current !== "diagnostics" && <Link to="/diagnostics">Diagnostics</Link>}
    {current !== "fly" && <Link to="/fly">Gyrocopter</Link>}
  </Bar>
);
