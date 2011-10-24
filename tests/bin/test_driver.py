import selenium
from selenium import webdriver


class Driver(object):
    def __init__(self, browser):
        self.passed = 0
        self.failed = 0
        self.total = 0
        self.browser = browser

    def go(self):
        self.browser.get("http://localhost/playcanvas/sdk/tests/all_tests.html")
        
        iframes = self.browser.find_elements_by_tag_name("iframe")
        
        for count, iframe in enumerate(iframes):
            self.browser.switch_to_default_content()
            self.browser.switch_to_frame(count)
            
            title = self.browser.find_element_by_id("qunit-header").text
    
            result = self.browser.find_element_by_id("qunit-testresult")
            
            self.passed = result.find_element_by_class_name("passed").text
            self.failed = result.find_element_by_class_name("failed").text
            self.total = result.find_element_by_class_name("total").text
            
            print("*** %s" % (title))
            print("*** Ran: %s tests, %s passed, %s failed" % (self.total, self.passed, self.failed))
            
        self.browser.quit()
