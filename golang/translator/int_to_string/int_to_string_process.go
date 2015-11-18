func int_to_string_process(input chan int, output chan string) {
  for {
    v := <- input
    output <- strconv.Itoa(v)
  }
}
