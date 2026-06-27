/**
 * Account / role / tenant switcher — root-level modal sheet.
 *
 * The admin test account (subhang.rocklee@gmail.com) is multi-role (admin +
 * teacher) on tenant_subhang. This sheet surfaces the active identity and the
 * sign-out seam; richer membership listing (switchActiveTenant) lands once the
 * identity callables are live and the More lane wires `useMe`.
 */
import { useRouter } from "expo-router";
import { Text, View } from "react-native";

import { Button, Card, Icon, ListRow, Screen, SectionHeader, TopBar } from "../components";
import { routes } from "../lib/routes";
import { useSession } from "../sdk/session";

export default function SwitcherScreen() {
  const router = useRouter();
  const { user, logout } = useSession();

  return (
    <Screen scroll={false} background="surface">
      <TopBar title="Account" onBack={() => router.back()} />
      <View className="flex-1 gap-4 px-1">
        <Card className="gap-2">
          <SectionHeader title="Signed in" />
          <ListRow
            title={user?.displayName ?? user?.email ?? "Admin"}
            subtitle={user?.email ?? undefined}
            leading={<Icon name="user" size={18} />}
          />
        </Card>

        <Card className="gap-2">
          <SectionHeader title="Memberships" subtitle="Tenant_Subhang (SUB001)" />
          <ListRow title="Admin · Subhang Academy" leading={<Icon name="shield" size={18} />} />
          <ListRow
            title="Teacher · Subhang Academy"
            leading={<Icon name="book-open" size={18} />}
          />
        </Card>

        <Button
          variant="danger"
          onPress={async () => {
            await logout();
            router.replace(routes.login());
          }}
        >
          Sign out
        </Button>

        <Text className="text-2xs text-text-muted px-1">
          Role / tenant switching activates once the identity callables deploy.
        </Text>
      </View>
    </Screen>
  );
}
