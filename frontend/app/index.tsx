import { Redirect } from "expo-router";

// O app sempre abre no Menu de Obras (público). O login acontece ao entrar em uma obra.
export default function Index() {
  return <Redirect href="/obras" />;
}
