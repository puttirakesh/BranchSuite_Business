import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '../../../src/features/employee/data';
import { Field } from '../../../src/features/employee/components';
import { s } from '../../../src/features/employee/styles';
import { TaskCard } from '../../../src/features/employee/cards';
import { useEmployeeWorkspace } from '../../../src/features/employee/workspace';

export default function TasksScreen() {
  const { records, filter, setFilter, query, setQuery, today, outstanding } = useEmployeeWorkspace();
  return (
    <>
      <View style={s.summary}>
        <View style={s.taskSummaryItem}>
          <Text style={s.taskSummaryValue}>{outstanding.length}</Text>
          <Text style={s.taskSummaryLabel}>to do</Text>
        </View>
        <View style={s.taskSummaryDivider} />
        <View style={s.taskSummaryItem}>
          <Text style={s.taskSummaryValue}>
            {outstanding.filter((t) => t.date === today).length}
          </Text>
          <Text style={s.taskSummaryLabel}>due today</Text>
        </View>
        <View style={s.taskSummaryDivider} />
        <View style={s.taskSummaryItem}>
          <Text style={s.taskSummaryValue}>
            {records.tasks.length - outstanding.length}
          </Text>
          <Text style={s.taskSummaryLabel}>completed</Text>
        </View>
      </View>
      <Field
        label="Search tasks"
        value={query}
        onChange={setQuery}
        placeholder="Search your assigned work"
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {["All", "Today", "Open", "In progress", "Completed"].map(
          (value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === value }}
              onPress={() => setFilter(value)}
              style={[s.chip, filter === value && s.chipSelected]}
            >
              <Text
                style={[
                  s.body,
                  filter === value && { color: colors.primary },
                ]}
              >
                {value}
              </Text>
            </Pressable>
          ),
        )}
      </ScrollView>
      {records.tasks
        .filter(
          (t) =>
            t.title.toLowerCase().includes(query.toLowerCase()) &&
            (filter === "All" ||
              (filter === "Today"
                ? t.date === today
                : t.status === filter)),
        )
        .map((task) => <TaskCard key={task.id} task={task} />)}
      {!records.tasks.some(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) &&
          (filter === "All" ||
            (filter === "Today"
              ? t.date === today
              : t.status === filter)),
      ) && (
        <Text style={s.small}>
          No matches. Try another search or filter.
        </Text>
      )}
    </>

  );
}
