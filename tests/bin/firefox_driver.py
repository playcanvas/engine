from selenium import webdriver
from test_driver import Driver

browser = webdriver.Firefox()
d = Driver(browser)
d.go()