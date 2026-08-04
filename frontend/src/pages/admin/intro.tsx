import {
  Button,
  Center,
  Container,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import Link from "next/link";
import Logo from "../../components/Logo";
import Meta from "../../components/Meta";
import useConfig from "../../hooks/config.hook";

const Intro = () => {
  const config = useConfig();
  const appName = config.get("general.appName") || "your site";
  return (
    <>
      <Meta title="Intro" />
      <Container size="xs">
        <Stack>
          <Center>
            <Logo height={80} width={80} />
          </Center>
          <Center>
            <Title order={2}>Welcome to {appName}</Title>
          </Center>
          <Text>
            Configure the basics, then head into {appName} when you are ready.
          </Text>
          <Text mt="lg">How do you want to continue?</Text>
          <Stack>
            <Button href="/admin/config/general" component={Link}>
              Customize configuration
            </Button>
            <Button href="/" component={Link} variant="light">
              Explore {appName}
            </Button>
          </Stack>
        </Stack>
      </Container>
    </>
  );
};

export default Intro;
